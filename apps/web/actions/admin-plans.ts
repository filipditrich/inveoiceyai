"use server";

import {
  parseDomainList,
  parseEntitlementsForm,
} from "@/lib/admin/parse-entitlements-form";
import {
  adminAssignPlan,
  adminUpdatePlanEntitlements,
} from "@/lib/admin/plans";
import { assertPlatformAdmin } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { EntitlementsSchema } from "@invoicey/db";

export async function assignWorkspacePlanAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const planId = String(formData.get("planId") ?? "").trim();
  const target = `/admin/workspaces/${workspaceId}`;

  const result = await adminAssignPlan({
    actorUserId: actor.userId,
    workspaceId,
    planId,
  });

  if (!result.ok) {
    redirect(`${target}?toast=admin_action_failed`);
  }

  revalidatePath(target);
  revalidatePath("/admin/workspaces");
  revalidatePath("/admin/plans");
  redirect(`${target}?toast=admin_plan_assigned`);
}

/**
 * Rewrites a plan's entitlements from the typed form.
 *
 * Grant rules are not editable here: their `key` is an idempotency identifier,
 * and changing one re-grants to every workspace already on the plan (ADR 0037).
 * They are carried through from the stored row untouched.
 */
export async function updatePlanEntitlementsAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const planId = String(formData.get("planId") ?? "").trim();
  const target = `/admin/plans/${planId}`;

  const existing = EntitlementsSchema.safeParse(
    JSON.parse(String(formData.get("currentEntitlements") ?? "null")),
  );
  if (!existing.success) {
    redirect(`${target}?toast=admin_action_failed`);
  }

  const entitlements = parseEntitlementsForm(formData, existing.data);

  const result = await adminUpdatePlanEntitlements({
    actorUserId: actor.userId,
    planId,
    entitlements,
    autoAssignEmailDomains: parseDomainList(
      formData.get("autoAssignEmailDomains"),
    ),
  });

  if (!result.ok) {
    redirect(`${target}?toast=admin_action_failed`);
  }

  revalidatePath(target);
  revalidatePath("/admin/plans");
  redirect(`${target}?toast=admin_plan_updated`);
}
