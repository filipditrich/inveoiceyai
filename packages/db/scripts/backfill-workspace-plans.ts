/**
 * Re-resolve plans for workspaces created before the `/organization/create`
 * hook existed (Plan 26 / ADR 0035).
 *
 *   bun run --cwd packages/db scripts/backfill-workspace-plans.ts \
 *     [--only=<workspace id or name>] [--apply]
 *
 * Dry run by default. Only touches workspaces whose plan was assigned by the
 * automatic rule (`plan_assigned_by IS NULL`) — a manual assignment from
 * `/admin/plans` is a deliberate decision and is never overwritten.
 *
 * Moving a live workspace onto a managed plan restricts who it may invoice, so
 * `--only` exists to make that a per-workspace decision rather than a sweep.
 *
 * Background: `createPersonalWorkspace` resolved a plan, but Better Auth's
 * `createOrganization` — which the multi-workspace UI calls — did not. Every
 * workspace after a user's first therefore landed on the default plan with no
 * signup grant, which is exactly the escape hatch the domain rule exists to
 * close.
 */
import "@invoicey/env/load";
import { eq, isNull } from "drizzle-orm";

import { ensureAiTokenBalance } from "../src/ai-tokens";
import { member, user as userTable } from "../src/auth-schema";
import { createDb } from "../src/create-db";
import {
  listPlanClients,
  syncPlanClientsIntoWorkspace,
} from "../src/plan-clients";
import {
  assignWorkspacePlan,
  getWorkspaceEntitlements,
  resolvePlanForNewWorkspace,
} from "../src/plans-repo";
import { applyTriggerGrants } from "../src/token-grants";
import { withDbTransaction } from "../src/transaction";
import { workspaces } from "../src/workspaces";

const apply = process.argv.includes("--apply");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg?.slice("--only=".length);

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("\n✗ DATABASE_URL is empty");
  process.exit(1);
}
const db = createDb(url);

const candidates = await db
  .select({ id: workspaces.id, name: workspaces.name })
  .from(workspaces)
  .where(isNull(workspaces.planAssignedBy));

const selected = only
  ? candidates.filter((w) => w.id === only || w.name === only)
  : candidates;

console.log(
  `\nauto-assigned workspaces: ${candidates.length}` +
    (only ? ` (filtered to ${selected.length} by --only)` : ""),
);

let changed = 0;
for (const workspace of selected) {
  // The owner is who the domain rule keys off.
  const [owner] = await db
    .select({ email: userTable.email, emailVerified: userTable.emailVerified })
    .from(member)
    .innerJoin(userTable, eq(userTable.id, member.userId))
    .where(eq(member.organizationId, workspace.id))
    .orderBy(member.createdAt)
    .limit(1);

  if (!owner) {
    console.log(`  skip     ${workspace.name} (no members)`);
    continue;
  }

  const [current, target] = await Promise.all([
    getWorkspaceEntitlements(db, workspace.id),
    resolvePlanForNewWorkspace(db, owner),
  ]);

  const moving = current?.planId !== target.id;
  if (moving) changed += 1;

  console.log(
    moving
      ? `  MOVE     ${workspace.name}: ${current?.planKey ?? "?"} -> ${target.key} (${owner.email})`
      : `  repair   ${workspace.name} -> ${target.key} (grants + catalog)`,
  );

  if (!apply) continue;

  // Runs even when the plan already matches. A workspace can sit on the right
  // plan with its signup grant or managed catalog missing — from a partial
  // failure, or from having been assigned before those steps existed — and a
  // backfill that skipped those would leave the damage in place. Every step
  // below is idempotent.
  await ensureAiTokenBalance(db, workspace.id);

  if (moving) {
    await assignWorkspacePlan(db, {
      workspaceId: workspace.id,
      planId: target.id,
      assignedBy: null,
    });
  }

  // `withDbTransaction`, not `db.transaction`: the eager `db` is neon-http,
  // which has no transaction support. The grant credit must be atomic with its
  // ledger insert (ADR 0037), so it needs the WebSocket-backed pool.
  await withDbTransaction(async (tx) =>
    applyTriggerGrants(tx, {
      workspaceId: workspace.id,
      entitlements: target.entitlements,
      trigger: "signup",
    }),
  );

  if (target.entitlements.clients.createMode === "managed") {
    await syncPlanClientsIntoWorkspace(
      db,
      workspace.id,
      await listPlanClients(db, target.id),
    );
  }
}

console.log(
  apply
    ? `\n✓ ${changed} workspace(s) moved`
    : `\n${changed} workspace(s) would move. Re-run with --apply.`,
);
