"use server";

import { approvalRules, decideApprovalTask } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireWorkspace, requireWorkspaceRole } from "@/lib/auth/session";

function optionalTrim(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function decideIncomingApprovalAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId, userId, role } = await requireWorkspace();
  const taskId = optionalTrim(formData.get("taskId"));
  const invoiceId = optionalTrim(formData.get("invoiceId"));
  const decision = optionalTrim(formData.get("decision")) as
    "approved" | "rejected" | "changes_requested" | null;
  const comment = optionalTrim(formData.get("comment"));
  if (!taskId || !invoiceId || !decision) {
    redirect("/incoming-invoices?invalid=missing_id");
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
      `/incoming-invoices/${invoiceId}?invalid=${encodeURIComponent(result.error)}`,
    );
  }
  revalidatePath("/incoming-invoices");
  redirect(`/incoming-invoices/${invoiceId}?toast=incoming_approval_decided`);
}

export async function saveApprovalRuleAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId, userId } = await requireWorkspaceRole("admin");
  const name = optionalTrim(formData.get("name"));
  const priority = Number(optionalTrim(formData.get("priority")) ?? "100");
  const conditionsRaw = optionalTrim(formData.get("conditions"));
  const pathRaw = optionalTrim(formData.get("path"));
  if (!name || !conditionsRaw || !pathRaw) {
    redirect("/settings/incoming-invoices?invalid=required_fields");
  }
  let conditions: unknown;
  let path: unknown;
  try {
    conditions = JSON.parse(conditionsRaw);
    path = JSON.parse(pathRaw);
  } catch {
    redirect("/settings/incoming-invoices?invalid=invalid_payload");
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
