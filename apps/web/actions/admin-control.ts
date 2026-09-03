"use server";

import {
  adminClearEntitlementOverrides,
  adminDisconnectBank,
  adminFreezeWorkspace,
  adminLiftEmailSuppression,
  adminRevokeApiKey,
  adminRevokeDriveDevice,
  adminRevokeSession,
  adminRevokeTrustedDevice,
  adminSaveEntitlementOverrides,
  adminUnfreezeWorkspace,
  adminUnpublishCommunityLook,
  type AdminControlError,
} from "@/lib/admin/control";
import { parseEntitlementsForm } from "@/lib/admin/parse-entitlements-form";
import { assertPlatformAdmin } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { EntitlementsSchema } from "@invoicey/db";

function toastFor(error: AdminControlError): string {
  switch (error) {
    case "not_found":
      return "admin_not_found";
    case "reason_required":
      return "admin_reason_required";
    case "invalid_entitlements":
      return "admin_action_failed";
    default:
      return "admin_action_failed";
  }
}

function userTarget(userId: string): string {
  return `/admin/users/${userId}`;
}

function workspaceTarget(workspaceId: string): string {
  return `/admin/workspaces/${workspaceId}`;
}

export async function revokeUserSessionAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const target = userTarget(userId);
  const result = await adminRevokeSession({
    actorUserId: actor.userId,
    userId,
    sessionId,
  });
  if (!result.ok) redirect(`${target}?toast=${toastFor(result.error)}`);
  revalidatePath(target);
  redirect(`${target}?toast=admin_session_revoked`);
}

export async function revokeUserDeviceAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const target = userTarget(userId);
  const result = await adminRevokeTrustedDevice({
    actorUserId: actor.userId,
    userId,
    deviceId,
  });
  if (!result.ok) redirect(`${target}?toast=${toastFor(result.error)}`);
  revalidatePath(target);
  redirect(`${target}?toast=admin_device_revoked`);
}

export async function revokeUserApiKeyAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  const apiKeyId = String(formData.get("apiKeyId") ?? "").trim();
  const target = userTarget(userId);
  const result = await adminRevokeApiKey({
    actorUserId: actor.userId,
    userId,
    apiKeyId,
  });
  if (!result.ok) redirect(`${target}?toast=${toastFor(result.error)}`);
  revalidatePath(target);
  redirect(`${target}?toast=admin_api_key_revoked`);
}

export async function revokeUserDriveDeviceAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const target = userTarget(userId);
  const result = await adminRevokeDriveDevice({
    actorUserId: actor.userId,
    userId,
    deviceId,
  });
  if (!result.ok) redirect(`${target}?toast=${toastFor(result.error)}`);
  revalidatePath(target);
  redirect(`${target}?toast=admin_drive_device_revoked`);
}

export async function freezeWorkspaceAction(formData: FormData): Promise<void> {
  const actor = await assertPlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "");
  const target = workspaceTarget(workspaceId);
  const result = await adminFreezeWorkspace({
    actorUserId: actor.userId,
    workspaceId,
    reason,
  });
  if (!result.ok) redirect(`${target}?toast=${toastFor(result.error)}`);
  revalidatePath(target);
  revalidatePath("/admin/workspaces");
  redirect(`${target}?toast=admin_workspace_frozen`);
}

export async function unfreezeWorkspaceAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const target = workspaceTarget(workspaceId);
  const result = await adminUnfreezeWorkspace({
    actorUserId: actor.userId,
    workspaceId,
  });
  if (!result.ok) redirect(`${target}?toast=${toastFor(result.error)}`);
  revalidatePath(target);
  revalidatePath("/admin/workspaces");
  redirect(`${target}?toast=admin_workspace_unfrozen`);
}

export async function saveWorkspaceOverridesAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const target = workspaceTarget(workspaceId);
  const existing = EntitlementsSchema.safeParse(
    JSON.parse(String(formData.get("currentEntitlements") ?? "null")),
  );
  if (!existing.success) {
    redirect(`${target}?toast=admin_action_failed`);
  }
  const result = await adminSaveEntitlementOverrides({
    actorUserId: actor.userId,
    workspaceId,
    next: parseEntitlementsForm(formData, existing.data),
  });
  if (!result.ok) redirect(`${target}?toast=${toastFor(result.error)}`);
  revalidatePath(target);
  redirect(`${target}?toast=admin_overrides_saved`);
}

export async function clearWorkspaceOverridesAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const target = workspaceTarget(workspaceId);
  const result = await adminClearEntitlementOverrides({
    actorUserId: actor.userId,
    workspaceId,
  });
  if (!result.ok) redirect(`${target}?toast=${toastFor(result.error)}`);
  revalidatePath(target);
  redirect(`${target}?toast=admin_overrides_cleared`);
}

export async function liftEmailSuppressionAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  const target =
    returnTo.startsWith("/admin/") && !returnTo.includes("://")
      ? returnTo
      : workspaceTarget(workspaceId);
  const result = await adminLiftEmailSuppression({
    actorUserId: actor.userId,
    workspaceId,
    email,
  });
  if (!result.ok) redirect(`${target}?toast=${toastFor(result.error)}`);
  revalidatePath(target);
  revalidatePath(workspaceTarget(workspaceId));
  redirect(`${target}?toast=admin_suppression_lifted`);
}

export async function unpublishCommunityLookAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const lookId = String(formData.get("lookId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  const target =
    returnTo.startsWith("/admin/") && !returnTo.includes("://")
      ? returnTo
      : workspaceTarget(workspaceId);
  const result = await adminUnpublishCommunityLook({
    actorUserId: actor.userId,
    workspaceId,
    lookId,
  });
  if (!result.ok) redirect(`${target}?toast=${toastFor(result.error)}`);
  revalidatePath(target);
  revalidatePath("/admin/looks");
  revalidatePath(workspaceTarget(workspaceId));
  redirect(`${target}?toast=admin_look_unpublished`);
}

export async function disconnectWorkspaceBankAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const connectionId = String(formData.get("connectionId") ?? "").trim();
  const provider = String(formData.get("provider") ?? "").trim();
  const target = workspaceTarget(workspaceId);
  const result = await adminDisconnectBank({
    actorUserId: actor.userId,
    workspaceId,
    connectionId,
    provider,
  });
  if (!result.ok) redirect(`${target}?toast=${toastFor(result.error)}`);
  revalidatePath(target);
  redirect(`${target}?toast=admin_bank_disconnected`);
}
