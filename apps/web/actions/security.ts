"use server";

import {
  listTrustedDevicesForUser,
  revokeTrustedDevice,
} from "@/lib/auth/device-trust";
import {
  listSecurityAuditEventsForUser,
  recordSecurityAuditEvent,
} from "@/lib/auth/security-audit";
import { getOptionalWorkspace, requireSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

import type { SecurityAuditEventType } from "@invoicey/db";

export async function getTrustedDevicesAction() {
  const session = await requireSession();
  return listTrustedDevicesForUser(session.id);
}

export async function revokeTrustedDeviceAction(deviceId: string) {
  const session = await requireSession();
  const ok = await revokeTrustedDevice({
    userId: session.id,
    deviceId,
  });
  if (ok) {
    await recordSecurityAuditEvent({
      userId: session.id,
      type: "device_revoke",
      metadata: { deviceId },
    });
  }
  revalidatePath("/settings/account/security");
  return { ok };
}

export async function getSecurityAuditAction() {
  const session = await requireSession();
  return listSecurityAuditEventsForUser(session.id, 25);
}

export async function recordAccountSecurityEventAction(input: {
  type: Extract<
    SecurityAuditEventType,
    | "account_link"
    | "account_unlink"
    | "api_key_create"
    | "api_key_revoke"
    | "session_revoke"
    | "invite_create"
    | "invite_resend"
    | "invite_cancel"
    | "invite_accept"
    | "invite_reject"
    | "member_remove"
    | "member_role_update"
  >;
  metadata?: Record<string, unknown>;
}) {
  const session = await requireSession();
  const workspace = await getOptionalWorkspace();
  await recordSecurityAuditEvent({
    userId: session.id,
    workspaceId: workspace?.workspaceId ?? null,
    type: input.type,
    metadata: input.metadata ?? {},
  });
  revalidatePath("/settings/account/security");
  return { ok: true as const };
}
