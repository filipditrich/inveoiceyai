"use server";

import {
  approvalRules,
  approvalTasks,
  decideApprovalTask,
  workflowPaths,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireWorkspace, requireWorkspaceRole } from "@/lib/auth/session";
import {
  incomingActionPath,
  safeIncomingReturnTo,
} from "@/lib/incoming-invoices/safe-return-to";

function optionalTrim(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function decideIncomingApprovalAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId, userId } = await requireWorkspace();
  const invoiceId = optionalTrim(formData.get("invoiceId"));
  const decision = optionalTrim(formData.get("decision")) as
    | "approved"
    | "rejected"
    | "changes_requested"
    | "return_previous"
    | "delegate"
    | null;
  const delegateTo = optionalTrim(formData.get("delegateToUserId"));
  const comment = optionalTrim(formData.get("comment"));
  const returnTo = safeIncomingReturnTo(formData.get("returnTo"));
  if (!invoiceId || !decision) {
    redirect("/incoming-invoices?invalid=missing_id");
  }
  // The task must already exist. Inventing one — as this action used to, with
  // assigneeRole "admin" — routes around whatever path the rules produced.
  let taskId = optionalTrim(formData.get("taskId"));
  if (!taskId) {
    const [existing] = await db
      .select({ id: approvalTasks.id })
      .from(approvalTasks)
      .where(
        and(
          eq(approvalTasks.incomingInvoiceId, invoiceId),
          eq(approvalTasks.workspaceId, workspaceId),
          eq(approvalTasks.status, "pending"),
          eq(approvalTasks.assigneeUserId, userId),
        ),
      )
      .limit(1);
    taskId = existing?.id ?? null;
  }
  if (!taskId) {
    redirect(
      incomingActionPath({
        returnTo,
        fallback: `/incoming-invoices/${invoiceId}`,
        invalid: "missing_id",
      }),
    );
  }
  const result = await decideApprovalTask({
    workspaceId,
    taskId,
    actorUserId: userId,
    decision,
    comment: comment ?? undefined,
    delegateToUserId: delegateTo ?? undefined,
  });
  if (!result.ok) {
    redirect(
      incomingActionPath({
        returnTo,
        fallback: `/incoming-invoices/${invoiceId}`,
        invalid: result.error,
      }),
    );
  }
  revalidatePath("/incoming-invoices");
  redirect(
    incomingActionPath({
      returnTo,
      fallback: `/incoming-invoices/${invoiceId}`,
      toast: "incoming_approval_decided",
    }),
  );
}

export async function saveApprovalRuleAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId, userId } = await requireWorkspaceRole("admin");
  const name = optionalTrim(formData.get("name"));
  const priority = Number(optionalTrim(formData.get("priority")) ?? "100");
  const pathId = optionalTrim(formData.get("pathId"));
  const whenCurrency = optionalTrim(formData.get("whenCurrency"));
  const minTotal = optionalTrim(formData.get("minTotal"));
  if (!name || !pathId) {
    redirect("/settings/incoming-invoices?invalid=required_fields");
  }

  const all: Array<Record<string, unknown>> = [];
  if (whenCurrency) {
    all.push({ fact: "currency", op: "eq", value: whenCurrency });
  }
  if (minTotal) {
    // The evaluator refuses an amount compare that does not pin a currency,
    // so the form pins one whenever an amount is given.
    if (!whenCurrency) {
      redirect(
        "/settings/incoming-invoices?invalid=currency_required_for_total",
      );
    }
    all.push({ fact: "total", op: "gte", value: minTotal });
  }
  if (all.length === 0) {
    all.push({ fact: "doc_type", op: "eq", value: "invoice" });
  }
  const conditions = { version: 1, all };

  const { validateApprovalRuleConditions } =
    await import("@invoicey/invoice-core");
  const checked = validateApprovalRuleConditions(conditions);
  if (!checked.ok) {
    redirect(
      `/settings/incoming-invoices?invalid=${encodeURIComponent(checked.error)}`,
    );
  }

  const [path] = await db
    .select({ id: workflowPaths.id })
    .from(workflowPaths)
    .where(
      and(
        eq(workflowPaths.id, pathId),
        eq(workflowPaths.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!path) {
    redirect("/settings/incoming-invoices?invalid=not_found");
  }

  const id = optionalTrim(formData.get("id"));
  if (id) {
    await db
      .update(approvalRules)
      .set({
        name,
        priority,
        pathId,
        conditions: conditions as Record<string, unknown>,
        isActive: formData.get("isActive") !== "off",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(approvalRules.id, id),
          eq(approvalRules.workspaceId, workspaceId),
        ),
      );
  } else {
    await db.insert(approvalRules).values({
      workspaceId,
      name,
      priority,
      pathId,
      conditions: conditions as Record<string, unknown>,
      createdByUserId: userId,
    });
  }
  revalidatePath("/settings/incoming-invoices");
  redirect("/settings/incoming-invoices?toast=approval_rule_saved");
}

export async function deleteApprovalRuleAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId } = await requireWorkspaceRole("admin");
  const id = optionalTrim(formData.get("id"));
  if (!id) {
    redirect("/settings/incoming-invoices?invalid=missing_id");
  }
  await db
    .delete(approvalRules)
    .where(
      and(eq(approvalRules.id, id), eq(approvalRules.workspaceId, workspaceId)),
    );
  revalidatePath("/settings/incoming-invoices");
  redirect("/settings/incoming-invoices?toast=approval_rule_deleted");
}
