import "server-only";

import { randomBytes } from "node:crypto";

import { trustedDevices, user } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";
import { and, desc, eq, isNull } from "drizzle-orm";

import {
  createTrustTokenWithSecret,
  hashDeviceTokenWithSecret,
  verifyTrustTokenWithSecret,
} from "./device-trust-crypto";

export const DEVICE_COOKIE_NAME = "invoicey_did";
const DEVICE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

function secret(): string {
  const s = env.BETTER_AUTH_SECRET?.trim();
  if (!s) {
    throw new Error("BETTER_AUTH_SECRET is required for device trust");
  }
  return s;
}

export function hashDeviceToken(rawToken: string): string {
  return hashDeviceTokenWithSecret(secret(), rawToken);
}

export function newDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function deviceCookieOptions(rawToken: string): {
  name: string;
  value: string;
  attributes: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
} {
  return {
    name: DEVICE_COOKIE_NAME,
    value: rawToken,
    attributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE_SEC,
    },
  };
}

function parseCookieHeader(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      const v = rest.join("=").trim();
      return v || null;
    }
  }
  return null;
}

export function readDeviceTokenFromHeaders(
  headers: Headers | { get: (k: string) => string | null },
): string | null {
  return parseCookieHeader(headers.get("cookie"), DEVICE_COOKIE_NAME);
}

export async function findTrustedDevice(opts: {
  userId: string;
  rawToken: string;
}) {
  const tokenHash = hashDeviceToken(opts.rawToken);
  const [row] = await db
    .select()
    .from(trustedDevices)
    .where(
      and(
        eq(trustedDevices.userId, opts.userId),
        eq(trustedDevices.tokenHash, tokenHash),
        isNull(trustedDevices.revokedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function touchTrustedDevice(deviceId: string, ip: string | null) {
  await db
    .update(trustedDevices)
    .set({
      lastSeenAt: new Date(),
      lastIp: ip,
    })
    .where(eq(trustedDevices.id, deviceId));
}

export async function listTrustedDevicesForUser(userId: string) {
  return db
    .select()
    .from(trustedDevices)
    .where(
      and(eq(trustedDevices.userId, userId), isNull(trustedDevices.revokedAt)),
    )
    .orderBy(desc(trustedDevices.lastSeenAt));
}

export async function revokeTrustedDevice(opts: {
  userId: string;
  deviceId: string;
}): Promise<boolean> {
  const updated = await db
    .update(trustedDevices)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(trustedDevices.id, opts.deviceId),
        eq(trustedDevices.userId, opts.userId),
        isNull(trustedDevices.revokedAt),
      ),
    )
    .returning({ id: trustedDevices.id });
  return updated.length > 0;
}

export async function trustDevice(opts: {
  userId: string;
  rawToken: string;
  label?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}): Promise<string> {
  const tokenHash = hashDeviceToken(opts.rawToken);
  const existing = await findTrustedDevice({
    userId: opts.userId,
    rawToken: opts.rawToken,
  });
  if (existing) {
    await touchTrustedDevice(existing.id, opts.ipAddress ?? null);
    return existing.id;
  }

  const id = randomBytes(16).toString("hex");
  await db.insert(trustedDevices).values({
    id,
    userId: opts.userId,
    tokenHash,
    label: opts.label ?? null,
    userAgent: opts.userAgent ?? null,
    lastIp: opts.ipAddress ?? null,
  });
  return id;
}

export function createTrustToken(opts: {
  userId: string;
  rawDeviceToken: string;
}): string {
  return createTrustTokenWithSecret(secret(), opts);
}

export function verifyTrustToken(token: string) {
  return verifyTrustTokenWithSecret(secret(), token);
}

export async function loadUserEmail(userId: string): Promise<{
  email: string;
  name: string;
  defaultWorkspaceId: string | null;
  createdAt: Date;
} | null> {
  const [row] = await db
    .select({
      email: user.email,
      name: user.name,
      defaultWorkspaceId: user.defaultWorkspaceId,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row ?? null;
}

export function summarizeUserAgent(ua: string | null | undefined): string {
  const raw = ua?.trim() || "";
  if (!raw) return "Neznámé zařízení";
  if (raw.length <= 80) return raw;
  return `${raw.slice(0, 77)}…`;
}
