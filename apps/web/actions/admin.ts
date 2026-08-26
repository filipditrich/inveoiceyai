"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  adminCancelInvite,
  adminDeleteWorkspace,
  adminGrantTokens,
  adminRemoveMember,
  adminRenameWorkspace,
  type AdminMutationError,
} from "@/lib/admin/mutations";
import { adminSetPlatformRole } from "@/lib/admin/set-platform-role";
import { assertPlatformAdmin } from "@/lib/auth/session";
import type { PlatformRole } from "@invoicey/db";

export async function setPlatformRoleAction(formData: FormData): Promise<void> {
  const actor = await assertPlatformAdmin();
  const targetUserId = String(formData.get("userId") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "").trim();
  const role: PlatformRole = roleRaw === "admin" ? "admin" : "none";
  const returnTo = String(formData.get("returnTo") ?? "/admin/users").trim();

  if (!targetUserId) {
    redirect(`${returnTo}?toast=platform_admin_failed`);
  }

  const result = await adminSetPlatformRole({
    actorUserId: actor.userId,
    targetUserId,
    role,
  });

  if (!result.ok) {
    redirect(
      `${returnTo}?toast=${
        result.error.includes("last platform admin")
          ? "platform_admin_last"
          : "platform_admin_failed"
      }`,
    );
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  redirect(
    `${returnTo}?toast=${
      role === "admin" ? "platform_admin_granted" : "platform_admin_revoked"
    }`,
  );
}

/** Toast slugs are shared with `ToastFromSearchParams`; keep them in the catalog. */
function toastFor(error: AdminMutationError): string {
  switch (error) {
    case "not_found":
      return "admin_not_found";
    case "invalid_amount":
      return "admin_invalid_amount";
    case "name_required":
      return "admin_name_required";
    case "last_owner":
      return "admin_last_owner";
    case "confirmation_mismatch":
      return "admin_confirmation_mismatch";
    default:
      return "admin_action_failed";
  }
}

export async function grantWorkspaceTokensAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const amount = Number.parseInt(
    String(formData.get("amount") ?? "").trim(),
    10,
  );
  const note = String(formData.get("note") ?? "").trim();
  const target = `/admin/workspaces/${workspaceId}`;

  const result = await adminGrantTokens({
    actorUserId: actor.userId,
    workspaceId,
    amount: Number.isNaN(amount) ? 0 : amount,
    note,
  });

  if (!result.ok) {
    redirect(`${target}?toast=${toastFor(result.error)}`);
  }

  revalidatePath(target);
  revalidatePath("/admin/workspaces");
  redirect(`${target}?toast=admin_tokens_granted`);
}

export async function renameWorkspaceAction(formData: FormData): Promise<void> {
  const actor = await assertPlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const name = String(formData.get("name") ?? "");
  const target = `/admin/workspaces/${workspaceId}`;

  const result = await adminRenameWorkspace({
    actorUserId: actor.userId,
    workspaceId,
    name,
  });

  if (!result.ok) {
    redirect(`${target}?toast=${toastFor(result.error)}`);
  }

  revalidatePath(target);
  revalidatePath("/admin/workspaces");
  redirect(`${target}?toast=admin_workspace_renamed`);
}

export async function deleteWorkspaceAction(formData: FormData): Promise<void> {
  const actor = await assertPlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const confirmation = String(formData.get("confirmation") ?? "");

  const result = await adminDeleteWorkspace({
    actorUserId: actor.userId,
    workspaceId,
    confirmation,
  });

  if (!result.ok) {
    redirect(
      `/admin/workspaces/${workspaceId}?toast=${toastFor(result.error)}`,
    );
  }

  revalidatePath("/admin/workspaces");
  revalidatePath("/admin");
  redirect("/admin/workspaces?toast=admin_workspace_deleted");
}

export async function removeWorkspaceMemberAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const targetUserId = String(formData.get("userId") ?? "").trim();
  const target = `/admin/workspaces/${workspaceId}`;

  const result = await adminRemoveMember({
    actorUserId: actor.userId,
    workspaceId,
    targetUserId,
  });

  if (!result.ok) {
    redirect(`${target}?toast=${toastFor(result.error)}`);
  }

  revalidatePath(target);
  redirect(`${target}?toast=admin_member_removed`);
}

export async function cancelWorkspaceInviteAction(
  formData: FormData,
): Promise<void> {
  const actor = await assertPlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const invitationId = String(formData.get("invitationId") ?? "").trim();
  const target = `/admin/workspaces/${workspaceId}`;

  const result = await adminCancelInvite({
    actorUserId: actor.userId,
    workspaceId,
    invitationId,
  });

  if (!result.ok) {
    redirect(`${target}?toast=${toastFor(result.error)}`);
  }

  revalidatePath(target);
  redirect(`${target}?toast=admin_invite_canceled`);
}
