import { and, eq, inArray } from "drizzle-orm";
import {
  evaluateApprovalRules,
  type ApprovalFacts,
  type EvaluatedPath,
} from "@invoicey/invoice-core/incoming";

import {
  approvalRules,
  approvalTasks,
  incomingInvoices,
  paymentAuditEvents,
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

function tasksForPath(
  workspaceId: string,
  invoiceId: string,
  ruleId: string | null,
  path: EvaluatedPath,
  step = 1,
): Array<{
  workspaceId: string;
  incomingInvoiceId: string;
  ruleId: string | null;
  step: number;
  assigneeUserId: string | null;
  assigneeRole: string | null;
}> {
  if (path.type === "auto_approve" || path.type === "fallback") {
    return [];
  }
  if (path.type === "sequence") {
    const first = path.steps[0];
    if (!first) return [];
    return tasksForPath(workspaceId, invoiceId, ruleId, first, 1);
  }
  return path.approvers.map((approver) => ({
    workspaceId,
    incomingInvoiceId: invoiceId,
    ruleId,
    step,
    assigneeUserId: approver.kind === "user" ? approver.id : null,
    assigneeRole: approver.kind === "role" ? approver.role : null,
  }));
}

export async function spawnApprovalForAcceptedInvoice(input: {
  workspaceId: string;
  invoiceId: string;
  validatedByUserId: string;
  facts: ApprovalFacts;
}): Promise<{ status: "approved" | "pending_approval" }> {
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
        path: rule.path,
      })),
      facts: input.facts,
      validatedByUserId: input.validatedByUserId,
    });

    if (evaluated.unreachable) {
      await addAuditEvent(tx, {
        workspaceId: input.workspaceId,
        action: "approval.path_unreachable",
        entityType: "incoming_invoice",
        entityId: input.invoiceId,
        payload: { ruleId: evaluated.ruleId },
      });
    }

    if (
      evaluated.path.type === "auto_approve" ||
      evaluated.path.type === "fallback"
    ) {
      await tx
        .update(incomingInvoices)
        .set({
          status: "approved",
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(incomingInvoices.id, input.invoiceId));
      await addAuditEvent(tx, {
        workspaceId: input.workspaceId,
        action: "incoming_invoice.approved",
        actorUserId: input.validatedByUserId,
        entityType: "incoming_invoice",
        entityId: input.invoiceId,
        payload: { automatic: true, ruleId: evaluated.ruleId },
      });
      return { status: "approved" };
    }

    const rows = tasksForPath(
      input.workspaceId,
      input.invoiceId,
      evaluated.ruleId,
      evaluated.path,
    );
    if (rows.length > 0) {
      await tx.insert(approvalTasks).values(rows);
    }
    await tx
      .update(incomingInvoices)
      .set({
        status: "pending_approval",
        updatedAt: new Date(),
      })
      .where(eq(incomingInvoices.id, input.invoiceId));
    return { status: "pending_approval" };
  });
}

export async function decideApprovalTask(input: {
  workspaceId: string;
  taskId: string;
  actorUserId: string;
  actorRole: "owner" | "admin" | "member";
  decision: "approved" | "rejected" | "changes_requested";
  comment?: string;
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
    if (task.status !== "pending")
      return { ok: false, error: "already_decided" };

    const allowedUser = task.assigneeUserId === input.actorUserId;
    const roleRank = { member: 1, admin: 2, owner: 3 };
    const allowedRole =
      task.assigneeRole != null &&
      roleRank[input.actorRole] >=
        roleRank[task.assigneeRole as keyof typeof roleRank];
    if (!allowedUser && !allowedRole) {
      return { ok: false, error: "forbidden" };
    }

    const [invoice] = await tx
      .select()
      .from(incomingInvoices)
      .where(eq(incomingInvoices.id, task.incomingInvoiceId))
      .for("update")
      .limit(1);
    if (!invoice) return { ok: false, error: "not_found" };
    if (
      input.decision === "approved" &&
      invoice.validatedByUserId === input.actorUserId
    ) {
      const siblings = await tx
        .select()
        .from(approvalTasks)
        .where(
          and(
            eq(approvalTasks.incomingInvoiceId, invoice.id),
            eq(approvalTasks.step, task.step),
            eq(approvalTasks.status, "pending"),
          ),
        );
      if (siblings.length === 1) {
        return { ok: false, error: "four_eyes" };
      }
    }

    if (input.decision === "changes_requested") {
      if (!input.comment?.trim())
        return { ok: false, error: "reason_required" };
      await tx
        .update(approvalTasks)
        .set({
          status: "cancelled",
          decidedByUserId: input.actorUserId,
          decidedAt: new Date(),
          comment: input.comment,
        })
        .where(
          and(
            eq(approvalTasks.incomingInvoiceId, invoice.id),
            eq(approvalTasks.status, "pending"),
          ),
        );
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
      if (!input.comment?.trim())
        return { ok: false, error: "reason_required" };
      await tx
        .update(approvalTasks)
        .set({
          status: "rejected",
          decidedByUserId: input.actorUserId,
          decidedAt: new Date(),
          comment: input.comment,
        })
        .where(eq(approvalTasks.id, task.id));
      await tx
        .update(approvalTasks)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(approvalTasks.incomingInvoiceId, invoice.id),
            eq(approvalTasks.status, "pending"),
          ),
        );
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

    await tx
      .update(approvalTasks)
      .set({
        status: "approved",
        decidedByUserId: input.actorUserId,
        decidedAt: new Date(),
        comment: input.comment ?? null,
      })
      .where(eq(approvalTasks.id, task.id));

    const [rule] = task.ruleId
      ? await tx
          .select()
          .from(approvalRules)
          .where(eq(approvalRules.id, task.ruleId))
          .limit(1)
      : [];
    const pathType = (rule?.path as { type?: string } | undefined)?.type;

    if (pathType === "one_of" || !pathType) {
      await tx
        .update(approvalTasks)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(approvalTasks.incomingInvoiceId, invoice.id),
            eq(approvalTasks.step, task.step),
            eq(approvalTasks.status, "pending"),
          ),
        );
    }

    if (pathType === "sequence") {
      const pendingSame = await tx
        .select({ id: approvalTasks.id })
        .from(approvalTasks)
        .where(
          and(
            eq(approvalTasks.incomingInvoiceId, invoice.id),
            eq(approvalTasks.step, task.step),
            eq(approvalTasks.status, "pending"),
          ),
        );
      if (pendingSame.length === 0) {
        const steps =
          (
            rule?.path as {
              steps?: Array<{
                type: "one_of" | "all_of";
                approvers: Array<{ kind: string; id?: string; role?: string }>;
              }>;
            }
          )?.steps ?? [];
        const next = steps[task.step];
        if (next) {
          await tx.insert(approvalTasks).values(
            next.approvers.map((approver) => ({
              workspaceId: input.workspaceId,
              incomingInvoiceId: invoice.id,
              ruleId: task.ruleId,
              step: task.step + 1,
              assigneeUserId:
                approver.kind === "user" ? (approver.id ?? null) : null,
              assigneeRole:
                approver.kind === "role" ? (approver.role ?? null) : null,
            })),
          );
          return { ok: true };
        }
      } else {
        return { ok: true };
      }
    }

    if (pathType === "all_of") {
      const pending = await tx
        .select({ id: approvalTasks.id })
        .from(approvalTasks)
        .where(
          and(
            eq(approvalTasks.incomingInvoiceId, invoice.id),
            inArray(approvalTasks.status, ["pending"]),
          ),
        );
      if (pending.length > 0) {
        return { ok: true };
      }
    }

    await tx
      .update(incomingInvoices)
      .set({
        status: "approved",
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(incomingInvoices.id, invoice.id));
    await addAuditEvent(tx, {
      workspaceId: input.workspaceId,
      action: "incoming_invoice.approved",
      actorUserId: input.actorUserId,
      entityType: "incoming_invoice",
      entityId: invoice.id,
    });
    return { ok: true };
  });
}
