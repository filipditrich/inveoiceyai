import { and, desc, eq, gt, inArray, isNotNull, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { member } from "./auth-schema";
import type { InvoiceyDb } from "./create-db";
import { pocketDevices, pocketPairGrants } from "./pocket-schema";
import { withDbTransaction } from "./transaction";

export const POCKET_PAIR_GRANT_TTL_MS = 5 * 60 * 1000;

export type PocketDeviceIdentity = {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
};

export async function insertPocketPairGrant(
  database: InvoiceyDb,
  input: {
    userId: string;
    workspaceId: string;
    codeHash: string;
    codeChallenge: string;
    redirectUri: string;
    deviceName: string | null;
  },
): Promise<void> {
  await database.insert(pocketPairGrants).values({
    id: randomUUID(),
    ...input,
    expiresAt: new Date(Date.now() + POCKET_PAIR_GRANT_TTL_MS),
  });
}

export async function consumePocketPairGrant(
  database: InvoiceyDb,
  codeHash: string,
  now = new Date(),
): Promise<{
  userId: string;
  workspaceId: string;
  codeChallenge: string;
  redirectUri: string;
  deviceName: string | null;
} | null> {
  const [grant] = await database
    .update(pocketPairGrants)
    .set({ usedAt: now })
    .where(
      and(
        eq(pocketPairGrants.codeHash, codeHash),
        isNull(pocketPairGrants.usedAt),
        gt(pocketPairGrants.expiresAt, now),
      ),
    )
    .returning({
      userId: pocketPairGrants.userId,
      workspaceId: pocketPairGrants.workspaceId,
      codeChallenge: pocketPairGrants.codeChallenge,
      redirectUri: pocketPairGrants.redirectUri,
      deviceName: pocketPairGrants.deviceName,
    });
  return grant ?? null;
}

export async function insertPocketDevice(
  database: InvoiceyDb,
  input: Omit<PocketDeviceIdentity, "id"> & {
    tokenHash: string;
    tokenFingerprint: string;
  },
): Promise<PocketDeviceIdentity> {
  const [device] = await database
    .insert(pocketDevices)
    .values(input)
    .returning({
      id: pocketDevices.id,
      userId: pocketDevices.userId,
      workspaceId: pocketDevices.workspaceId,
      name: pocketDevices.name,
    });
  if (!device) throw new Error("pocket_device_insert_failed");
  return device;
}

export async function findActivePocketDeviceByTokenHash(
  database: InvoiceyDb,
  tokenHash: string,
): Promise<PocketDeviceIdentity | null> {
  const [device] = await database
    .select({
      id: pocketDevices.id,
      userId: pocketDevices.userId,
      workspaceId: pocketDevices.workspaceId,
      name: pocketDevices.name,
    })
    .from(pocketDevices)
    .innerJoin(
      member,
      and(
        eq(member.userId, pocketDevices.userId),
        eq(member.organizationId, pocketDevices.workspaceId),
      ),
    )
    .where(
      and(
        eq(pocketDevices.tokenHash, tokenHash),
        isNull(pocketDevices.revokedAt),
      ),
    )
    .limit(1);
  return device ?? null;
}

export async function touchPocketDevice(
  database: InvoiceyDb,
  deviceId: string,
): Promise<void> {
  await database
    .update(pocketDevices)
    .set({ lastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(pocketDevices.id, deviceId));
}

export async function registerPocketPushToken(input: {
  deviceId: string;
  apnsToken: string;
  environment: "sandbox" | "production";
}): Promise<void> {
  await withDbTransaction(async (database) => {
    await database
      .update(pocketDevices)
      .set({ apnsToken: null, pushEnabled: false, updatedAt: new Date() })
      .where(eq(pocketDevices.apnsToken, input.apnsToken));
    await database
      .update(pocketDevices)
      .set({
        apnsToken: input.apnsToken,
        apnsEnvironment: input.environment,
        pushEnabled: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pocketDevices.id, input.deviceId),
          isNull(pocketDevices.revokedAt),
        ),
      );
  });
}

export async function disablePocketPushToken(
  database: InvoiceyDb,
  deviceId: string,
): Promise<void> {
  await database
    .update(pocketDevices)
    .set({ pushEnabled: false, apnsToken: null, updatedAt: new Date() })
    .where(eq(pocketDevices.id, deviceId));
}

export async function listPushEnabledPocketDevices(
  database: InvoiceyDb,
  input: { workspaceId: string; userIds: string[] },
) {
  if (input.userIds.length === 0) return [];
  return database
    .select({
      id: pocketDevices.id,
      userId: pocketDevices.userId,
      apnsToken: pocketDevices.apnsToken,
      environment: pocketDevices.apnsEnvironment,
    })
    .from(pocketDevices)
    .where(
      and(
        eq(pocketDevices.workspaceId, input.workspaceId),
        inArray(pocketDevices.userId, input.userIds),
        eq(pocketDevices.pushEnabled, true),
        isNotNull(pocketDevices.apnsToken),
        isNull(pocketDevices.revokedAt),
      ),
    );
}

export async function listPocketDevicesForUser(
  database: InvoiceyDb,
  userId: string,
) {
  return database
    .select({
      id: pocketDevices.id,
      workspaceId: pocketDevices.workspaceId,
      name: pocketDevices.name,
      tokenFingerprint: pocketDevices.tokenFingerprint,
      pushEnabled: pocketDevices.pushEnabled,
      lastSeenAt: pocketDevices.lastSeenAt,
      revokedAt: pocketDevices.revokedAt,
      createdAt: pocketDevices.createdAt,
    })
    .from(pocketDevices)
    .where(eq(pocketDevices.userId, userId))
    .orderBy(desc(pocketDevices.createdAt));
}
