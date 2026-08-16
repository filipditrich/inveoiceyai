"use server";

import {
  approvalRules,
  approvalTasks,
  decideApprovalTask,
  incomingInvoices,
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
  const { workspaceId, userId, role } = await requireWorkspace();
  let taskId = optionalTrim(formData.get("taskId"));
  const invoiceId = optionalTrim(formData.get("invoiceId"));
  const decision = optionalTrim(formData.get("decision")) as
    "approved" | "rejected" | "changes_requested" | null;
  const comment = optionalTrim(formData.get("comment"));
  const returnTo = safeIncomingReturnTo(formData.get("returnTo"));
  if (!invoiceId || !decision) {
    redirect("/incoming-invoices?invalid=missing_id");
  }
  if (!taskId) {
    const [existing] = await db
      .select({ id: approvalTasks.id })
      .from(approvalTasks)
      .where(
        and(
          eq(approvalTasks.incomingInvoiceId, invoiceId),
          eq(approvalTasks.workspaceId, workspaceId),
          eq(approvalTasks.status, "pending"),
        ),
      )
      .limit(1);
    if (existing) {
      taskId = existing.id;
    } else {
      const [invoice] = await db
        .select({ status: incomingInvoices.status })
        .from(incomingInvoices)
        .where(
          and(
            eq(incomingInvoices.id, invoiceId),
            eq(incomingInvoices.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      if (invoice?.status === "pending_approval") {
        const [created] = await db
          .insert(approvalTasks)
          .values({
            workspaceId,
            incomingInvoiceId: invoiceId,
            step: 1,
            assigneeRole: "admin",
          })
          .returning({ id: approvalTasks.id });
        taskId = created?.id ?? null;
      }
    }
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
    actorRole: role,
    decision,
    comment: comment ?? undefined,
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
  const pathType = optionalTrim(formData.get("pathType"));
  const conditionsRaw = optionalTrim(formData.get("conditions"));
  const pathRaw = optionalTrim(formData.get("path"));
  if (!name) {
    redirect("/settings/incoming-invoices?invalid=required_fields");
  }
  let conditions: unknown;
  let path: unknown;
  if (pathType === "auto_approve" || pathType === "require_admin") {
    const whenCurrency = optionalTrim(formData.get("whenCurrency")) ?? "CZK";
    const pathCurrency =
      optionalTrim(formData.get("pathCurrency")) ?? whenCurrency;
    const maxTotal = optionalTrim(formData.get("maxTotal")) ?? "5000";
    conditions = {
      version: 1,
      all: [{ fact: "currency", op: "eq", value: whenCurrency }],
    };
    path =
      pathType === "require_admin"
        ? { type: "one_of", approvers: [{ kind: "role", role: "admin" }] }
        : { type: "auto_approve", maxTotal, currency: pathCurrency };
  } else if (conditionsRaw && pathRaw) {
    try {
      conditions = JSON.parse(conditionsRaw);
      path = JSON.parse(pathRaw);
    } catch {
      redirect("/settings/incoming-invoices?invalid=invalid_payload");
    }
  } else {
    redirect("/settings/incoming-invoices?invalid=required_fields");
  }
  const { validateApprovalRulePayload: validate } =
    await import("@invoicey/invoice-core");
  const checked = validate({ conditions, path });
  if (!checked.ok) {
    redirect(
      `/settings/incoming-invoices?invalid=${encodeURIComponent(checked.error)}`,
    );
  }
  const id = optionalTrim(formData.get("id"));
  if (id) {
    await db
      .update(approvalRules)
      .set({
        name,
        priority,
        conditions: conditions as Record<string, unknown>,
        path: path as Record<string, unknown>,
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
      conditions: conditions as Record<string, unknown>,
      path: path as Record<string, unknown>,
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
