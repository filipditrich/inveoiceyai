/**
 * Exercises the Plan 25c workflow path engine against a real database.
 *
 *   bun run --cwd packages/db scripts/verify-workflow-paths.ts
 *
 * Creates a scratch team, path and rule, drives one invoice through approval,
 * then rolls everything back. Prints a pass/fail line per assertion.
 */
import "@invoicey/env/load";

import { and, eq } from "drizzle-orm";

import { db } from "../src/client";
import {
  approvalRules,
  approvalTasks,
  incomingInvoices,
  member,
  teamMembers,
  teams,
  user,
  workflowPathStepApprovers,
  workflowPathSteps,
  workflowPaths,
} from "../src/schema";
import {
  decideApprovalTask,
  spawnApprovalForValidatedInvoice,
} from "../src/approvals-repo";

let failures = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}`, detail === undefined ? "" : detail);
  }
}

const [ws] = await db.select().from(incomingInvoices).limit(1);
if (!ws) throw new Error("seed incoming invoices first");
const workspaceId = ws.workspaceId;
const actor = "DxbR8IFIfJXmXfSPomuLAGtgp80y7zRU";

console.log("workspace", workspaceId);

// ---------------------------------------------------------------- fixtures
// A second person, so a two-step path has someone new to ask at step 2.
const secondId = `verify-user-${Date.now()}`;
await db.insert(user).values({
  id: secondId,
  name: "Verify Second Approver",
  email: `${secondId}@example.invalid`,
  emailVerified: false,
});
await db.insert(member).values({
  id: `verify-member-${Date.now()}`,
  organizationId: workspaceId,
  userId: secondId,
  role: "admin",
});

const [team] = await db
  .insert(teams)
  .values({ workspaceId, name: `verify-${Date.now()}` })
  .returning();
await db
  .insert(teamMembers)
  .values({ workspaceId, teamId: team.id, userId: actor });

const [path] = await db
  .insert(workflowPaths)
  .values({
    workspaceId,
    name: `verify-path-${Date.now()}`,
    stage: "approval",
    // Four-eyes off: this workspace has one member, who also validated.
    fourEyes: false,
  })
  .returning();
const [step1] = await db
  .insert(workflowPathSteps)
  .values({ workspaceId, pathId: path.id, position: 1, mode: "any_one" })
  .returning();
await db
  .insert(workflowPathStepApprovers)
  .values({ workspaceId, stepId: step1.id, kind: "team", teamId: team.id });
const [step2] = await db
  .insert(workflowPathSteps)
  .values({ workspaceId, pathId: path.id, position: 2, mode: "any_one" })
  .returning();
await db
  .insert(workflowPathStepApprovers)
  .values({ workspaceId, stepId: step2.id, kind: "user", userId: secondId });

// A separate path whose only step nobody can satisfy: its team is empty.
const [emptyTeam] = await db
  .insert(teams)
  .values({ workspaceId, name: `verify-empty-${Date.now()}` })
  .returning();
const [brokenPath] = await db
  .insert(workflowPaths)
  .values({
    workspaceId,
    name: `verify-broken-${Date.now()}`,
    stage: "approval",
    fourEyes: false,
  })
  .returning();
const [brokenStep] = await db
  .insert(workflowPathSteps)
  .values({ workspaceId, pathId: brokenPath.id, position: 1, mode: "any_one" })
  .returning();
await db
  .insert(workflowPathStepApprovers)
  .values({
    workspaceId,
    stepId: brokenStep.id,
    kind: "team",
    teamId: emptyTeam.id,
  });

const [rule] = await db
  .insert(approvalRules)
  .values({
    workspaceId,
    name: `verify-rule-${Date.now()}`,
    priority: 1,
    pathId: path.id,
    conditions: {
      version: 1,
      all: [{ fact: "currency", op: "eq", value: "CZK" }],
    },
  })
  .returning();

// A rule at the same priority must not throw — the old unique index did.
const [rule2] = await db
  .insert(approvalRules)
  .values({
    workspaceId,
    name: `verify-rule-2-${Date.now()}`,
    priority: 1,
    pathId: path.id,
    conditions: {
      version: 1,
      all: [{ fact: "currency", op: "eq", value: "EUR" }],
    },
  })
  .returning();
check("two rules can share a priority", Boolean(rule2));

// ------------------------------------------------------------------- spawn
const [target] = await db
  .select()
  .from(incomingInvoices)
  .where(
    and(
      eq(incomingInvoices.workspaceId, workspaceId),
      eq(incomingInvoices.status, "needs_validation"),
    ),
  )
  .limit(1);
if (!target) throw new Error("no needs_validation invoice to drive");

await db
  .update(incomingInvoices)
  .set({
    status: "validated",
    validatedByUserId: actor,
    validatedAt: new Date(),
  })
  .where(eq(incomingInvoices.id, target.id));

const spawned = await spawnApprovalForValidatedInvoice({
  workspaceId,
  invoiceId: target.id,
  validatedByUserId: actor,
  facts: {
    supplierIsTrusted: false,
    supplierIsNew: false,
    docType: target.docType,
    currency: target.currency,
    total: target.total ?? "0",
    newBeneficiaryAccount: false,
    extractionSource: target.extractionSource,
    hasExceptions: false,
    lowConfidence: false,
  },
});
check(
  "spawn puts the invoice in approval",
  spawned.status === "pending_approval",
  spawned,
);

const step1Tasks = await db
  .select()
  .from(approvalTasks)
  .where(eq(approvalTasks.incomingInvoiceId, target.id));
check("one task for step 1", step1Tasks.length === 1, step1Tasks.length);
check(
  "task resolved the team to a person",
  step1Tasks[0]?.assigneeUserId === actor,
);
check("task carries the path", step1Tasks[0]?.pathId === path.id);
check("task carries required=1 for any_one", step1Tasks[0]?.required === 1);

// ------------------------------------------------------------------ decide
const first = await decideApprovalTask({
  workspaceId,
  taskId: step1Tasks[0].id,
  actorUserId: actor,
  decision: "approved",
});
check("step 1 approval succeeds", first.ok === true, first);

const afterFirst = await db
  .select()
  .from(approvalTasks)
  .where(eq(approvalTasks.incomingInvoiceId, target.id));
const step2Task = afterFirst.find(
  (t) => t.step === 2 && t.status === "pending",
);
check("step 2 task was created", Boolean(step2Task));

const [midway] = await db
  .select({ status: incomingInvoices.status })
  .from(incomingInvoices)
  .where(eq(incomingInvoices.id, target.id));
check(
  "invoice is not approved mid-path",
  midway.status === "pending_approval",
  midway.status,
);

// The same person approved step 1, so step 2 should have skipped them and
// escalated — with one member and role owner, step 2 resolves to nobody new.
check(
  "step 2 is assigned to the second person",
  step2Task?.assigneeUserId === secondId,
);

if (step2Task) {
  const wrongPerson = await decideApprovalTask({
    workspaceId,
    taskId: step2Task.id,
    actorUserId: actor,
    decision: "approved",
  });
  check(
    "step 2 refuses someone who is not its assignee",
    wrongPerson.ok === false,
  );

  const second = await decideApprovalTask({
    workspaceId,
    taskId: step2Task.id,
    actorUserId: secondId,
    decision: "approved",
  });
  check("step 2 approval succeeds", second.ok === true, second);

  const [done] = await db
    .select({
      status: incomingInvoices.status,
      approvedAt: incomingInvoices.approvedAt,
    })
    .from(incomingInvoices)
    .where(eq(incomingInvoices.id, target.id));
  check(
    "invoice reaches approved after both steps",
    done.status === "approved",
    done.status,
  );
  check("approvedAt is set", Boolean(done.approvedAt));
}

// A decided task cannot be decided twice.
const replay = await decideApprovalTask({
  workspaceId,
  taskId: step1Tasks[0].id,
  actorUserId: actor,
  decision: "approved",
});
check("a decided task cannot be re-decided", replay.ok === false);

// ------------------------------------------------- unreachable path is safe
const [other] = await db
  .select()
  .from(incomingInvoices)
  .where(
    and(
      eq(incomingInvoices.workspaceId, workspaceId),
      eq(incomingInvoices.status, "needs_validation"),
    ),
  )
  .limit(1);
if (other) {
  await db
    .update(approvalRules)
    .set({ pathId: brokenPath.id })
    .where(eq(approvalRules.id, rule.id));
  await db
    .update(incomingInvoices)
    .set({ status: "validated", validatedByUserId: actor })
    .where(eq(incomingInvoices.id, other.id));

  const broken = await spawnApprovalForValidatedInvoice({
    workspaceId,
    invoiceId: other.id,
    validatedByUserId: actor,
    facts: {
      supplierIsTrusted: false,
      supplierIsNew: false,
      docType: other.docType,
      currency: other.currency,
      total: other.total ?? "0",
      newBeneficiaryAccount: false,
      extractionSource: other.extractionSource,
      hasExceptions: false,
      lowConfidence: false,
    },
  });
  check(
    "an unresolvable path reports unassigned",
    broken.status === "unassigned",
    broken,
  );

  const [brokenInvoice] = await db
    .select({ status: incomingInvoices.status })
    .from(incomingInvoices)
    .where(eq(incomingInvoices.id, other.id));
  check(
    "an unresolvable path never approves the invoice",
    brokenInvoice.status === "pending_approval",
    brokenInvoice.status,
  );

  await db
    .delete(approvalTasks)
    .where(eq(approvalTasks.incomingInvoiceId, other.id));
  await db
    .update(incomingInvoices)
    .set({ status: "needs_validation", validatedByUserId: null })
    .where(eq(incomingInvoices.id, other.id));
}

// ----------------------------------------------------------------- cleanup
await db
  .delete(approvalTasks)
  .where(eq(approvalTasks.incomingInvoiceId, target.id));
await db.delete(approvalRules).where(eq(approvalRules.id, rule.id));
await db.delete(approvalRules).where(eq(approvalRules.id, rule2.id));
await db.delete(workflowPaths).where(eq(workflowPaths.id, path.id));
await db.delete(workflowPaths).where(eq(workflowPaths.id, brokenPath.id));
await db.delete(teams).where(eq(teams.id, team.id));
await db.delete(teams).where(eq(teams.id, emptyTeam.id));
await db.delete(member).where(eq(member.userId, secondId));
await db.delete(user).where(eq(user.id, secondId));
await db
  .update(incomingInvoices)
  .set({
    status: "needs_validation",
    validatedAt: null,
    validatedByUserId: null,
    approvedAt: null,
  })
  .where(eq(incomingInvoices.id, target.id));

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
