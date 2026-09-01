"use server";

import { recordSecurityAuditEvent } from "@/lib/auth/security-audit";
import { requireSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

import {
  listMemberWorkspaces,
  revokeDriveDevice,
  upsertDriveUserSettings,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import type { DriveLayoutParseError } from "@invoicey/invoice-core";

export async function saveDriveSettingsAction(input: {
  layoutTemplate: string;
  includeIsdoc: boolean;
  hiddenWorkspaceIds: string[];
}): Promise<{ ok: true } | { ok: false; error: DriveLayoutParseError }> {
  const session = await requireSession();
  const memberships = await listMemberWorkspaces(db, session.id);
  const allowed = new Set(memberships.map((workspace) => workspace.id));
  const hiddenWorkspaceIds = input.hiddenWorkspaceIds.filter((id) =>
    allowed.has(id),
  );
  const result = await upsertDriveUserSettings(db, {
    userId: session.id,
    layoutTemplate: input.layoutTemplate,
    includeIsdoc: input.includeIsdoc,
    hiddenWorkspaceIds,
  });
  if (!result.ok) {
    return result;
  }
  revalidatePath("/settings/account/drive");
  return { ok: true };
}

export async function revokeDriveDeviceAction(
  deviceId: string,
): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const ok = await revokeDriveDevice({
    db,
    userId: session.id,
    deviceId,
  });
  if (ok) {
    await recordSecurityAuditEvent({
      userId: session.id,
      type: "drive_device_revoke",
      metadata: { deviceId, source: "settings" },
    });
  }
  revalidatePath("/settings/account/drive");
  revalidatePath("/settings/account/security");
  return { ok };
}
