import "server-only";
import { revokeTrustedDevice } from "@/lib/auth/device-trust";
import { recordSecurityAuditEvent } from "@/lib/auth/security-audit";
import { deleteFioConnection } from "@/lib/payments/fio-service";
import { deleteMonetaConnection } from "@/lib/payments/moneta-service";
import { and, eq } from "drizzle-orm";

import {
  apikey,
  assignWorkspacePlan,
  computeEntitlementOverrides,
  emailSuppressions,
  getPlanById,
  getWorkspaceEntitlements,
  revokeDriveDevice,
  session,
  unpublishCommunityLookRows,
  workspaces,
  type Entitlements,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

export type AdminControlResult =
  | { ok: true }
  | { ok: false; error: AdminControlError };

export type AdminControlError =
  | "not_found"
  | "reason_required"
  | "invalid_entitlements"
  | "failed";

async function loadWorkspaceName(
  workspaceId: string,
): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return row ?? null;
}

export async function adminRevokeSession(input: {
  actorUserId: string;
  userId: string;
  sessionId: string;
}): Promise<AdminControlResult> {
  const deleted = await db
    .delete(session)
    .where(
      and(eq(session.id, input.sessionId), eq(session.userId, input.userId)),
    )
    .returning({ id: session.id });
  if (deleted.length === 0) {
    return { ok: false, error: "not_found" };
  }
  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    type: "platform_session_revoke",
    metadata: { targetUserId: input.userId, sessionId: input.sessionId },
  });
  return { ok: true };
}

export async function adminRevokeTrustedDevice(input: {
  actorUserId: string;
  userId: string;
  deviceId: string;
}): Promise<AdminControlResult> {
  const ok = await revokeTrustedDevice({
    userId: input.userId,
    deviceId: input.deviceId,
  });
  if (!ok) return { ok: false, error: "not_found" };
  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    type: "platform_device_revoke",
    metadata: { targetUserId: input.userId, deviceId: input.deviceId },
  });
  return { ok: true };
}

export async function adminRevokeApiKey(input: {
  actorUserId: string;
  userId: string;
  apiKeyId: string;
}): Promise<AdminControlResult> {
  const deleted = await db
    .delete(apikey)
    .where(
      and(eq(apikey.id, input.apiKeyId), eq(apikey.referenceId, input.userId)),
    )
    .returning({ id: apikey.id, name: apikey.name, start: apikey.start });
  const row = deleted[0];
  if (!row) return { ok: false, error: "not_found" };
  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    type: "platform_api_key_revoke",
    metadata: {
      targetUserId: input.userId,
      apiKeyId: row.id,
      name: row.name,
      start: row.start,
    },
  });
  return { ok: true };
}

export async function adminRevokeDriveDevice(input: {
  actorUserId: string;
  userId: string;
  deviceId: string;
}): Promise<AdminControlResult> {
  const ok = await revokeDriveDevice({
    db,
    userId: input.userId,
    deviceId: input.deviceId,
  });
  if (!ok) return { ok: false, error: "not_found" };
  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    type: "platform_drive_device_revoke",
    metadata: { targetUserId: input.userId, deviceId: input.deviceId },
  });
  return { ok: true };
}

export async function adminFreezeWorkspace(input: {
  actorUserId: string;
  workspaceId: string;
  reason: string;
}): Promise<AdminControlResult> {
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "reason_required" };
  const workspace = await loadWorkspaceName(input.workspaceId);
  if (!workspace) return { ok: false, error: "not_found" };

  await db
    .update(workspaces)
    .set({
      frozenAt: new Date(),
      frozenBy: input.actorUserId,
      freezeReason: reason.slice(0, 500),
    })
    .where(eq(workspaces.id, workspace.id));

  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    workspaceId: workspace.id,
    type: "platform_workspace_freeze",
    metadata: { workspaceName: workspace.name, reason: reason.slice(0, 500) },
  });
  return { ok: true };
}

export async function adminUnfreezeWorkspace(input: {
  actorUserId: string;
  workspaceId: string;
}): Promise<AdminControlResult> {
  const workspace = await loadWorkspaceName(input.workspaceId);
  if (!workspace) return { ok: false, error: "not_found" };

  await db
    .update(workspaces)
    .set({ frozenAt: null, frozenBy: null, freezeReason: null })
    .where(eq(workspaces.id, workspace.id));

  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    workspaceId: workspace.id,
    type: "platform_workspace_unfreeze",
    metadata: { workspaceName: workspace.name },
  });
  return { ok: true };
}

export async function adminSaveEntitlementOverrides(input: {
  actorUserId: string;
  workspaceId: string;
  next: Entitlements;
}): Promise<AdminControlResult> {
  const state = await getWorkspaceEntitlements(db, input.workspaceId);
  if (!state) return { ok: false, error: "not_found" };
  const plan = await getPlanById(db, state.planId);
  if (!plan) return { ok: false, error: "not_found" };

  const overrides = computeEntitlementOverrides(plan.entitlements, input.next);
  try {
    await assignWorkspacePlan(db, {
      workspaceId: input.workspaceId,
      planId: plan.id,
      assignedBy: input.actorUserId,
      overrides,
    });
  } catch (error) {
    console.error("[admin] entitlement override failed", error);
    return { ok: false, error: "failed" };
  }

  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    workspaceId: input.workspaceId,
    type: "platform_entitlement_override",
    metadata: {
      planId: plan.id,
      cleared: overrides == null,
      keys: overrides ? Object.keys(overrides) : [],
    },
  });
  return { ok: true };
}

export async function adminClearEntitlementOverrides(input: {
  actorUserId: string;
  workspaceId: string;
}): Promise<AdminControlResult> {
  const state = await getWorkspaceEntitlements(db, input.workspaceId);
  if (!state) return { ok: false, error: "not_found" };

  try {
    await assignWorkspacePlan(db, {
      workspaceId: input.workspaceId,
      planId: state.planId,
      assignedBy: input.actorUserId,
      overrides: null,
    });
  } catch (error) {
    console.error("[admin] entitlement override clear failed", error);
    return { ok: false, error: "failed" };
  }

  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    workspaceId: input.workspaceId,
    type: "platform_entitlement_override",
    metadata: { planId: state.planId, cleared: true },
  });
  return { ok: true };
}

export async function adminLiftEmailSuppression(input: {
  actorUserId: string;
  workspaceId: string;
  email: string;
}): Promise<AdminControlResult> {
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "not_found" };
  const deleted = await db
    .delete(emailSuppressions)
    .where(
      and(
        eq(emailSuppressions.workspaceId, input.workspaceId),
        eq(emailSuppressions.email, email),
      ),
    )
    .returning({ email: emailSuppressions.email });
  if (deleted.length === 0) return { ok: false, error: "not_found" };

  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    workspaceId: input.workspaceId,
    type: "platform_email_suppression_lift",
    metadata: { email },
  });
  return { ok: true };
}

export async function adminUnpublishCommunityLook(input: {
  actorUserId: string;
  workspaceId: string;
  lookId: string;
}): Promise<AdminControlResult> {
  const count = await unpublishCommunityLookRows(
    db,
    input.workspaceId,
    input.lookId,
  );
  if (count === 0) return { ok: false, error: "not_found" };

  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    workspaceId: input.workspaceId,
    type: "platform_community_look_unpublish",
    metadata: { lookId: input.lookId },
  });
  return { ok: true };
}

export async function adminDisconnectBank(input: {
  actorUserId: string;
  workspaceId: string;
  connectionId: string;
  provider: string;
}): Promise<AdminControlResult> {
  if (input.provider !== "fio" && input.provider !== "moneta") {
    return { ok: false, error: "not_found" };
  }
  const disconnect =
    input.provider === "moneta" ? deleteMonetaConnection : deleteFioConnection;
  const ok = await disconnect({
    workspaceId: input.workspaceId,
    connectionId: input.connectionId,
    userId: input.actorUserId,
  });
  if (!ok) return { ok: false, error: "not_found" };

  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    workspaceId: input.workspaceId,
    type: "platform_bank_disconnect",
    metadata: { connectionId: input.connectionId, provider: input.provider },
  });
  return { ok: true };
}
