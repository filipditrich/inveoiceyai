"use server";

import { EntitlementsSchema } from "@invoicey/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  adminAssignPlan,
  adminUpdatePlanEntitlements,
} from "@/lib/admin/plans";
import { assertPlatformAdmin } from "@/lib/auth/session";

/** `""` and `"unlimited"` both mean no ceiling; anything else must parse. */
function nullableLimit(raw: FormDataEntryValue | null): number | null {
  const value = String(raw ?? "").trim();
  if (value === "" || value.toLowerCase() === "unlimited") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function integer(raw: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Presence, not value. An unchecked box submits nothing at all, and Base UI's
 * checkbox submits the field *name* as its value rather than the native `"on"`
 * — so comparing against any particular string silently reads every box as
 * false.
 */
const checked = (form: FormData, name: string) => form.get(name) !== null;

/** `"nfctron.com, example.com"` → `["nfctron.com", "example.com"]`. */
function domainList(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(/[\s,]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

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

  const entitlements = {
    ...existing.data,
    seats: { max: nullableLimit(formData.get("seatsMax")) },
    issuers: { max: nullableLimit(formData.get("issuersMax")) },
    ai: {
      ...existing.data.ai,
      monthlyIncludedTokens: integer(formData.get("monthlyIncludedTokens")),
      topUpEnabled: checked(formData, "topUpEnabled"),
    },
    clients: {
      createMode:
        formData.get("clientsCreateMode") === "managed"
          ? ("managed" as const)
          : ("open" as const),
    },
    permissions: {
      mode: (["off", "roles", "advanced"] as const).includes(
        formData.get("permissionsMode") as never,
      )
        ? (String(formData.get("permissionsMode")) as
            "off" | "roles" | "advanced")
        : ("off" as const),
    },
    features: {
      bankConnections: checked(formData, "bankConnections"),
      recurring: checked(formData, "recurring"),
      historicalImport: checked(formData, "historicalImport"),
      agents: checked(formData, "agents"),
    },
    auth: {
      allowedEmailDomains: domainList(formData.get("allowedEmailDomains")),
    },
    audit: { retentionDays: nullableLimit(formData.get("auditRetentionDays")) },
  };

  const result = await adminUpdatePlanEntitlements({
    actorUserId: actor.userId,
    planId,
    entitlements,
    autoAssignEmailDomains: domainList(formData.get("autoAssignEmailDomains")),
  });

  if (!result.ok) {
    redirect(`${target}?toast=admin_action_failed`);
  }

  revalidatePath(target);
  revalidatePath("/admin/plans");
  redirect(`${target}?toast=admin_plan_updated`);
}
