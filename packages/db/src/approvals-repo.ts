import {
  evaluateApprovalRules,
  resolveWorkflowPath,
  type ApprovalFacts,
  type ResolvedStep,
  type WorkflowFacts,
  type WorkflowPath,
  type WorkflowResolutionContext,
  type WorkflowStage,
  type WorkspaceRole,
} from "@invoicey/invoice-core/incoming";
import { and, asc, eq, inArray } from "drizzle-orm";

import { member } from "./auth-schema";
import {
  approvalRules,
  approvalTasks,
  incomingInvoices,
  paymentAuditEvents,
  teamMembers,
  workflowPathStepApprovers,
  workflowPathSteps,
  workflowPaths,
} from "./schema";
import { withDbTransaction, type DbTransaction } from "./transaction";

async function addAuditEvent(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    action: string;
    actorUserId?: string;
    entityType: string;
    entityId: string;
    payload?: Record<string, unknown>;
  },
) {
  await tx.insert(paymentAuditEvents).values({
    workspaceId: input.workspaceId,
    action: input.action,
    actorType: input.actorUserId ? "user" : "system",
    actorUserId: input.actorUserId,
    entityType: input.entityType,
    entityId: input.entityId,
    payloadJson: input.payload ?? {},
  });
}

/** Loads a stored path into the shape the domain resolver expects. */
export async function loadWorkflowPath(
  tx: DbTransaction,
  workspaceId: string,
  pathId: string,
): Promise<WorkflowPath | null> {
  const [path] = await tx
    .select()
    .from(workflowPaths)
    .where(
      and(
        eq(workflowPaths.id, pathId),
        eq(workflowPaths.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!path) return null;

  const steps = await tx
    .select()
    .from(workflowPathSteps)
    .where(eq(workflowPathSteps.pathId, path.id))
    .orderBy(asc(workflowPathSteps.position));
  const approvers = steps.length
    ? await tx
        .select()
        .from(workflowPathStepApprovers)
        .where(
          inArray(
            workflowPathStepApprovers.stepId,
            steps.map((step) => step.id),
          ),
        )
    : [];

  return {
    id: path.id,
    stage: path.stage,
    name: path.name,
    fourEyes: path.fourEyes,
    autoApprove: path.autoApprove,
    autoApproveMaxTotal: path.autoApproveMaxTotal,
    autoApproveCurrency: path.autoApproveCurrency,
    steps: steps.map((step) => ({
      position: step.position,
      mode: step.mode,
      quorum: step.quorum,
      label: step.label,
      approvers: approvers
        .filter((row) => row.stepId === step.id)
        .map((row) => {
          switch (row.kind) {
            case "user":
              return { kind: "user" as const, userId: row.userId ?? "" };
            case "team":
              return { kind: "team" as const, teamId: row.teamId ?? "" };
            case "role":
              return {
                kind: "role" as const,
                role: (row.role ?? "admin") as WorkspaceRole,
              };
            default:
              return {
                kind: "dynamic" as const,
                dynamic: (row.dynamic ?? "uploaded_by") as never,
              };
          }
        }),
    })),
  };
}

export async function loadFallbackPath(
  tx: DbTransaction,
  workspaceId: string,
  stage: WorkflowStage,
): Promise<WorkflowPath | null> {
  const [row] = await tx
    .select({ id: workflowPaths.id })
    .from(workflowPaths)
    .where(
      and(
        eq(workflowPaths.workspaceId, workspaceId),
        eq(workflowPaths.stage, stage),
        eq(workflowPaths.isFallback, true),
        eq(workflowPaths.isActive, true),
      ),
    )
    .limit(1);
  return row ? loadWorkflowPath(tx, workspaceId, row.id) : null;
}

/**
 * Approver references become people here, at task-creation time, so a team
 * edited between two invoices affects the next one.
 */
export async function buildResolutionContext(
  tx: DbTransaction,
  workspaceId: string,
  input: {
    excludeUserId?: string | null;
    alreadyApprovedUserIds?: string[];
    dynamic?: WorkflowResolutionContext["dynamic"];
  },
): Promise<WorkflowResolutionContext> {
  const teamRows = await tx
    .select({ teamId: teamMembers.teamId, userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.workspaceId, workspaceId));
  const teams: Record<string, string[]> = {};
  for (const row of teamRows) {
    (teams[row.teamId] ??= []).push(row.userId);
  }

  const memberRows = await tx
    .select({ userId: member.userId, role: member.role })
    .from(member)
    .where(eq(member.organizationId, workspaceId));
  const owners = memberRows
    .filter((r) => r.role === "owner")
    .map((r) => r.userId);
  const admins = memberRows
    .filter((r) => r.role === "owner" || r.role === "admin")
    .map((r) => r.userId);

  return {
    teamMembers: teams,
    // "at or above", matching the permission ladder.
    roleMembers: {
      owner: owners,
      admin: admins,
      member: memberRows.map((r) => r.userId),
    },
    dynamic: input.dynamic ?? {},
    excludeUserId: input.excludeUserId ?? null,
    alreadyApprovedUserIds: input.alreadyApprovedUserIds ?? [],
  };
}

function stepTaskRows(input: {
  workspaceId: string;
  invoiceId: string;
  ruleId: string | null;
  pathId: string;
  stage: WorkflowStage;
  step: ResolvedStep;
}) {
  return input.step.assignees.map((userId) => ({
    workspaceId: input.workspaceId,
    incomingInvoiceId: input.invoiceId,
    ruleId: input.ruleId,
    pathId: input.pathId,
    stage: input.stage,
    step: input.step.position,
    required: input.step.required,
    assigneeUserId: userId,
  }));
}

export type SpawnResult =
  | { status: "approved" }
  | { status: "pending_approval" }
  /** A path was chosen but nobody could be assigned; a human must intervene. */
  | { status: "unassigned"; reason: string };

/**
 * Gate 2. Chooses a path from the rules, resolves it against the current
 * membership, and either approves automatically, creates the first step's
 * tasks, or leaves the invoice visibly unassigned.
 *
 * It never approves an invoice because a path could not be resolved — that is
 * the failure mode this replaces.
 */
export async function spawnApprovalForValidatedInvoice(input: {
  workspaceId: string;
  invoiceId: string;
  validatedByUserId: string;
  facts: ApprovalFacts;
  uploadedByUserId?: string | null;
}): Promise<SpawnResult> {
  return withDbTransaction(async (tx) => {
    const rules = await tx
      .select()
      .from(approvalRules)
      .where(eq(approvalRules.workspaceId, input.workspaceId));
    const evaluated = evaluateApprovalRules({
      rules: rules.map((rule) => ({
        id: rule.id,
        priority: rule.priority,
        isActive: rule.isActive,
        conditions: rule.conditions,
        pathId: rule.pathId,
        createdAt: rule.createdAt,
      })),
      facts: input.facts,
    });

    const chosen = evaluated.pathId
      ? await loadWorkflowPath(tx, input.workspaceId, evaluated.pathId)
      : null;
    const path =
      chosen ?? (await loadFallbackPath(tx, input.workspaceId, "approval"));

    // No path configured at all: the gate auto-passes, and says so.
    if (!path) {
      await approveInvoice(tx, {
        workspaceId: input.workspaceId,
        invoiceId: input.invoiceId,
        actorUserId: input.validatedByUserId,
        payload: { automatic: true, reason: "no_path_configured" },
      });
      return { status: "approved" };
    }

    const context = await buildResolutionContext(tx, input.workspaceId, {
      excludeUserId: input.validatedByUserId,
      dynamic: { uploaded_by: input.uploadedByUserId ?? null },
    });
    const facts: WorkflowFacts = {
      currency: input.facts.currency,
      total: input.facts.total,
      supplierIsTrusted: input.facts.supplierIsTrusted,
      newBeneficiaryAccount: input.facts.newBeneficiaryAccount,
      hasBlockingFindings: input.facts.hasExceptions,
      extractionSource: input.facts.extractionSource,
      lowConfidence: input.facts.lowConfidence,
    };

    let resolved = resolveWorkflowPath({ path, facts, context });

    // A chosen path that cannot run escalates to the fallback, once.
    if (resolved.kind === "fallback" && chosen) {
      await addAuditEvent(tx, {
        workspaceId: input.workspaceId,
        action: "approval.path_unreachable",
        entityType: "incoming_invoice",
        entityId: input.invoiceId,
        payload: { pathId: path.id, reason: resolved.reason },
      });
      const fallback = await loadFallbackPath(
        tx,
        input.workspaceId,
        "approval",
      );
      if (fallback && fallback.id !== path.id) {
        resolved = resolveWorkflowPath({ path: fallback, facts, context });
        if (resolved.kind !== "fallback") {
          return applyResolved(tx, {
            ...input,
            ruleId: evaluated.ruleId,
            pathId: fallback.id,
            resolved,
          });
        }
      }
    }

    if (resolved.kind === "fallback") {
      await tx
        .update(incomingInvoices)
        .set({ status: "pending_approval", updatedAt: new Date() })
        .where(eq(incomingInvoices.id, input.invoiceId));
      await addAuditEvent(tx, {
        workspaceId: input.workspaceId,
        action: "approval.unassigned",
        entityType: "incoming_invoice",
        entityId: input.invoiceId,
        payload: { pathId: path.id, reason: resolved.reason },
      });
      return { status: "unassigned", reason: resolved.reason };
    }

    return applyResolved(tx, {
      ...input,
      ruleId: evaluated.ruleId,
      pathId: path.id,
      resolved,
    });
  });
}

async function applyResolved(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    invoiceId: string;
    validatedByUserId: string;
    ruleId: string | null;
    pathId: string;
    resolved: Exclude<
      ReturnType<typeof resolveWorkflowPath>,
      { kind: "fallback" }
    >;
  },
): Promise<SpawnResult> {
  if (input.resolved.kind === "auto_approve") {
    await approveInvoice(tx, {
      workspaceId: input.workspaceId,
      invoiceId: input.invoiceId,
      actorUserId: input.validatedByUserId,
      payload: { automatic: true, pathId: input.pathId, ruleId: input.ruleId },
    });
    return { status: "approved" };
  }

  const first = input.resolved.steps.find((step) => !step.satisfied);
  if (!first) {
    // Every step was already satisfied by earlier approvals.
    await approveInvoice(tx, {
      workspaceId: input.workspaceId,
      invoiceId: input.invoiceId,
      actorUserId: input.validatedByUserId,
      payload: { pathId: input.pathId, reason: "all_steps_satisfied" },
    });
    return { status: "approved" };
  }
  await tx.insert(approvalTasks).values(
    stepTaskRows({
      workspaceId: input.workspaceId,
      invoiceId: input.invoiceId,
      ruleId: input.ruleId,
      pathId: input.pathId,
      stage: "approval",
      step: first,
    }),
  );
  await tx
    .update(incomingInvoices)
    .set({ status: "pending_approval", updatedAt: new Date() })
    .where(eq(incomingInvoices.id, input.invoiceId));
  return { status: "pending_approval" };
}

async function approveInvoice(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    invoiceId: string;
    actorUserId?: string;
    payload?: Record<string, unknown>;
  },
) {
  await tx
    .update(incomingInvoices)
    .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(incomingInvoices.id, input.invoiceId));
  await addAuditEvent(tx, {
    workspaceId: input.workspaceId,
    action: "incoming_invoice.approved",
    actorUserId: input.actorUserId,
    entityType: "incoming_invoice",
    entityId: input.invoiceId,
    payload: input.payload,
  });
}

export type ApprovalDecision =
  | "approved"
  | "rejected"
  | "changes_requested"
  | "return_previous"
  | "delegate";

export async function decideApprovalTask(input: {
  workspaceId: string;
  taskId: string;
  actorUserId: string;
  decision: ApprovalDecision;
  comment?: string;
  /** Required for `delegate`. */
  delegateToUserId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return withDbTransaction(async (tx) => {
    const [task] = await tx
      .select()
      .from(approvalTasks)
      .where(
        and(
          eq(approvalTasks.id, input.taskId),
          eq(approvalTasks.workspaceId, input.workspaceId),
        ),
      )
      .for("update")
      .limit(1);
    if (!task) return { ok: false, error: "not_found" };
    if (task.status !== "pending") {
      return { ok: false, error: "already_decided" };
    }
    if (task.assigneeUserId !== input.actorUserId) {
      return { ok: false, error: "forbidden" };
    }

    const [invoice] = await tx
      .select()
      .from(incomingInvoices)
      .where(eq(incomingInvoices.id, task.incomingInvoiceId))
      .for("update")
      .limit(1);
    if (!invoice) return { ok: false, error: "not_found" };

    const needsComment =
      input.decision === "rejected" ||
      input.decision === "changes_requested" ||
      input.decision === "return_previous";
    if (needsComment && !input.comment?.trim()) {
      return { ok: false, error: "reason_required" };
    }

    if (input.decision === "delegate") {
      if (!input.delegateToUserId)
        return { ok: false, error: "missing_target" };
      if (input.delegateToUserId === input.actorUserId) {
        return { ok: false, error: "delegate_to_self" };
      }
      await tx
        .update(approvalTasks)
        .set({
          status: "delegated",
          decidedByUserId: input.actorUserId,
          decidedAt: new Date(),
          comment: input.comment ?? null,
        })
        .where(eq(approvalTasks.id, task.id));
      await tx.insert(approvalTasks).values({
        workspaceId: input.workspaceId,
        incomingInvoiceId: invoice.id,
        ruleId: task.ruleId,
        pathId: task.pathId,
        stage: task.stage,
        step: task.step,
        required: task.required,
        assigneeUserId: input.delegateToUserId,
        delegatedFromTaskId: task.id,
      });
      await addAuditEvent(tx, {
        workspaceId: input.workspaceId,
        action: "approval.delegated",
        actorUserId: input.actorUserId,
        entityType: "incoming_invoice",
        entityId: invoice.id,
        payload: { taskId: task.id, to: input.delegateToUserId },
      });
      return { ok: true };
    }

    if (input.decision === "changes_requested") {
      await cancelPending(tx, invoice.id, input.actorUserId, input.comment);
      await tx
        .update(incomingInvoices)
        .set({
          status: "needs_validation",
          notes: input.comment,
          updatedAt: new Date(),
        })
        .where(eq(incomingInvoices.id, invoice.id));
      return { ok: true };
    }

    if (input.decision === "rejected") {
      await tx
        .update(approvalTasks)
        .set({
          status: "rejected",
          decidedByUserId: input.actorUserId,
          decidedAt: new Date(),
          comment: input.comment,
        })
        .where(eq(approvalTasks.id, task.id));
      await cancelPending(tx, invoice.id);
      await tx
        .update(incomingInvoices)
        .set({
          status: "rejected",
          rejectedAt: new Date(),
          rejectedByUserId: input.actorUserId,
          rejectionReason: input.comment,
          updatedAt: new Date(),
        })
        .where(eq(incomingInvoices.id, invoice.id));
      return { ok: true };
    }

    if (input.decision === "return_previous") {
      // Step 1 has no previous level: returning from there is a return to the
      // accountant, which is what "changes requested" already means.
      if (task.step <= 1 || !task.pathId) {
        await cancelPending(tx, invoice.id, input.actorUserId, input.comment);
        await tx
          .update(incomingInvoices)
          .set({
            status: "needs_validation",
            notes: input.comment,
            updatedAt: new Date(),
          })
          .where(eq(incomingInvoices.id, invoice.id));
        return { ok: true };
      }
      await cancelPending(tx, invoice.id, input.actorUserId, input.comment);
      const reopened = await createStepTasks(tx, {
        workspaceId: input.workspaceId,
        invoice,
        pathId: task.pathId,
        ruleId: task.ruleId,
        position: task.step - 1,
        // The person who returned it must approve again afterwards, so they are
        // not excluded from the reopened step's successors.
        alreadyApprovedUserIds: [],
      });
      if (reopened.kind !== "created") {
        return { ok: false, error: "step_unreachable" };
      }
      await addAuditEvent(tx, {
        workspaceId: input.workspaceId,
        action: "approval.returned_to_previous",
        actorUserId: input.actorUserId,
        entityType: "incoming_invoice",
        entityId: invoice.id,
        payload: { fromStep: task.step, toStep: task.step - 1 },
      });
      return { ok: true };
    }

    // Approved.
    await tx
      .update(approvalTasks)
      .set({
        status: "approved",
        decidedByUserId: input.actorUserId,
        decidedAt: new Date(),
        comment: input.comment ?? null,
      })
      .where(eq(approvalTasks.id, task.id));

    const stepTasks = await tx
      .select()
      .from(approvalTasks)
      .where(
        and(
          eq(approvalTasks.incomingInvoiceId, invoice.id),
          eq(approvalTasks.step, task.step),
        ),
      );
    const approvals = stepTasks.filter((row) => row.status === "approved");
    if (approvals.length < task.required) {
      return { ok: true };
    }

    // Step satisfied: nobody else needs to act on it.
    await tx
      .update(approvalTasks)
      .set({ status: "skipped" })
      .where(
        and(
          eq(approvalTasks.incomingInvoiceId, invoice.id),
          eq(approvalTasks.step, task.step),
          eq(approvalTasks.status, "pending"),
        ),
      );

    if (task.pathId) {
      // Everyone who has approved anywhere on this invoice, not just this step.
      const approvedByAnyone = await tx
        .select({ userId: approvalTasks.decidedByUserId })
        .from(approvalTasks)
        .where(
          and(
            eq(approvalTasks.incomingInvoiceId, invoice.id),
            eq(approvalTasks.status, "approved"),
          ),
        );
      const advanced = await createStepTasks(tx, {
        workspaceId: input.workspaceId,
        invoice,
        pathId: task.pathId,
        ruleId: task.ruleId,
        position: task.step + 1,
        alreadyApprovedUserIds: approvedByAnyone
          .map((row) => row.userId)
          .filter((id): id is string => Boolean(id)),
      });
      if (advanced.kind === "created") return { ok: true };
      if (advanced.kind === "unreachable") {
        // The path cannot continue. Leaving the invoice unapproved and visible
        // is the only safe outcome; approving it here is how routing failures
        // used to become silent approvals.
        await addAuditEvent(tx, {
          workspaceId: input.workspaceId,
          action: "approval.unassigned",
          actorUserId: input.actorUserId,
          entityType: "incoming_invoice",
          entityId: invoice.id,
          payload: { fromStep: task.step, reason: advanced.reason },
        });
        return { ok: true };
      }
    }

    await approveInvoice(tx, {
      workspaceId: input.workspaceId,
      invoiceId: invoice.id,
      actorUserId: input.actorUserId,
    });
    return { ok: true };
  });
}

async function cancelPending(
  tx: DbTransaction,
  invoiceId: string,
  actorUserId?: string,
  comment?: string,
) {
  await tx
    .update(approvalTasks)
    .set({
      status: "cancelled",
      decidedByUserId: actorUserId ?? null,
      decidedAt: actorUserId ? new Date() : null,
      comment: comment ?? null,
    })
    .where(
      and(
        eq(approvalTasks.incomingInvoiceId, invoiceId),
        eq(approvalTasks.status, "pending"),
      ),
    );
}

export type AdvanceResult =
  /** Tasks were created; the invoice stays in approval. */
  | { kind: "created" }
  /** No step left to run; the path is finished. */
  | { kind: "complete" }
  /** A step exists but resolves to nobody. Never treat this as approval. */
  | { kind: "unreachable"; reason: string };

/**
 * Creates the tasks for the next step of a path that still needs someone,
 * skipping steps already satisfied by earlier approvals.
 */
async function createStepTasks(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    invoice: typeof incomingInvoices.$inferSelect;
    pathId: string;
    ruleId: string | null;
    position: number;
    alreadyApprovedUserIds: string[];
  },
): Promise<AdvanceResult> {
  const path = await loadWorkflowPath(tx, input.workspaceId, input.pathId);
  if (!path) return { kind: "unreachable", reason: "path_missing" };
  if (!path.steps.some((step) => step.position >= input.position)) {
    return { kind: "complete" };
  }

  const context = await buildResolutionContext(tx, input.workspaceId, {
    excludeUserId: path.fourEyes ? input.invoice.validatedByUserId : null,
    alreadyApprovedUserIds: input.alreadyApprovedUserIds,
  });
  const resolved = resolveWorkflowPath({
    path,
    facts: {
      currency: input.invoice.currency,
      total: input.invoice.total ?? "0",
      supplierIsTrusted: true,
      newBeneficiaryAccount: false,
      hasBlockingFindings: false,
      extractionSource: input.invoice.extractionSource,
      lowConfidence: false,
    },
    context,
  });
  if (resolved.kind === "auto_approve") {
    // An auto-approve path has no steps to advance into.
    return { kind: "complete" };
  }
  if (resolved.kind === "fallback") {
    return { kind: "unreachable", reason: resolved.reason };
  }
  const step = resolved.steps.find(
    (row) => row.position >= input.position && !row.satisfied,
  );
  if (!step) return { kind: "complete" };

  await tx.insert(approvalTasks).values(
    stepTaskRows({
      workspaceId: input.workspaceId,
      invoiceId: input.invoice.id,
      ruleId: input.ruleId,
      pathId: input.pathId,
      stage: path.stage,
      step,
    }),
  );
  return { kind: "created" };
}
