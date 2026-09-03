import "server-only";
import { listTrustedDevicesForUser } from "@/lib/auth/device-trust";
import { desc, eq } from "drizzle-orm";

import { apikey, listDriveDevicesForUser, session } from "@invoicey/db";
import { db } from "@invoicey/db/client";

export type AdminUserSessionRow = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  activeOrganizationId: string | null;
};

export type AdminUserApiKeyRow = {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  enabled: boolean | null;
  createdAt: Date;
  lastRequest: Date | null;
  expiresAt: Date | null;
};

export async function adminListUserSessions(
  userId: string,
): Promise<AdminUserSessionRow[]> {
  return db
    .select({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      activeOrganizationId: session.activeOrganizationId,
    })
    .from(session)
    .where(eq(session.userId, userId))
    .orderBy(desc(session.createdAt));
}

export async function adminListUserApiKeys(
  userId: string,
): Promise<AdminUserApiKeyRow[]> {
  return db
    .select({
      id: apikey.id,
      name: apikey.name,
      start: apikey.start,
      prefix: apikey.prefix,
      enabled: apikey.enabled,
      createdAt: apikey.createdAt,
      lastRequest: apikey.lastRequest,
      expiresAt: apikey.expiresAt,
    })
    .from(apikey)
    .where(eq(apikey.referenceId, userId))
    .orderBy(desc(apikey.createdAt));
}

export async function adminListUserAccess(userId: string) {
  const [sessions, devices, apiKeys, driveDevices] = await Promise.all([
    adminListUserSessions(userId),
    listTrustedDevicesForUser(userId),
    adminListUserApiKeys(userId),
    listDriveDevicesForUser(db, userId),
  ]);
  return {
    sessions,
    devices,
    apiKeys,
    driveDevices: driveDevices.filter((device) => device.revokedAt == null),
  };
}
