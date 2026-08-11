import "server-only";

import { referralEvents, user } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, count, eq, isNull } from "drizzle-orm";

import { newReferralCode } from "./referral-code";

export { newReferralCode } from "./referral-code";

export const REFERRAL_COOKIE_NAME = "invoicey_ref";
const REFERRAL_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

export function referralCookieOptions(code: string): {
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
    name: REFERRAL_COOKIE_NAME,
    value: code,
    attributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: REFERRAL_COOKIE_MAX_AGE_SEC,
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

export function readReferralCodeFromHeaders(
  headers: Headers | { get: (k: string) => string | null },
): string | null {
  return parseCookieHeader(headers.get("cookie"), REFERRAL_COOKIE_NAME);
}

export async function ensureUserReferralCode(userId: string): Promise<string> {
  const [existing] = await db
    .select({ referralCode: user.referralCode })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; ; attempt += 1) {
    const code = newReferralCode();
    try {
      const updated = await db
        .update(user)
        .set({ referralCode: code, updatedAt: new Date() })
        .where(and(eq(user.id, userId), isNull(user.referralCode)))
        .returning({ referralCode: user.referralCode });
      if (updated[0]?.referralCode) return updated[0].referralCode;
      const [again] = await db
        .select({ referralCode: user.referralCode })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      if (again?.referralCode) return again.referralCode;
    } catch (error) {
      if (attempt >= 4 || !isUniqueViolation(error)) throw error;
    }
  }
}

export async function findUserByReferralCode(code: string): Promise<{
  id: string;
  name: string;
  referralCode: string;
} | null> {
  const normalized = code.trim();
  if (!normalized) return null;
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      referralCode: user.referralCode,
    })
    .from(user)
    .where(eq(user.referralCode, normalized))
    .limit(1);
  if (!row?.referralCode) return null;
  return {
    id: row.id,
    name: row.name,
    referralCode: row.referralCode,
  };
}

export async function recordReferralClick(opts: {
  referrerUserId: string;
  code: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await db.insert(referralEvents).values({
    referrerUserId: opts.referrerUserId,
    code: opts.code,
    type: "click",
    ipAddress: opts.ipAddress ?? null,
    userAgent: opts.userAgent ?? null,
  });
}

/** set referred_by once; returns true when a signup event was recorded */
export async function attributeReferralFromCode(opts: {
  newUserId: string;
  code: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<boolean> {
  const referrer = await findUserByReferralCode(opts.code);
  if (!referrer) return false;
  if (referrer.id === opts.newUserId) return false;

  const updated = await db
    .update(user)
    .set({
      referredByUserId: referrer.id,
      updatedAt: new Date(),
    })
    .where(and(eq(user.id, opts.newUserId), isNull(user.referredByUserId)))
    .returning({ id: user.id });

  if (updated.length === 0) return false;

  await db.insert(referralEvents).values({
    referrerUserId: referrer.id,
    code: referrer.referralCode,
    type: "signup",
    referredUserId: opts.newUserId,
    ipAddress: opts.ipAddress ?? null,
    userAgent: opts.userAgent ?? null,
  });
  return true;
}

export async function getReferralStats(referrerUserId: string): Promise<{
  clicks: number;
  signups: number;
}> {
  const rows = await db
    .select({
      type: referralEvents.type,
      total: count(referralEvents.id),
    })
    .from(referralEvents)
    .where(eq(referralEvents.referrerUserId, referrerUserId))
    .groupBy(referralEvents.type);

  let clicks = 0;
  let signups = 0;
  for (const row of rows) {
    const n = Number(row.total ?? 0);
    if (row.type === "click") clicks = n;
    if (row.type === "signup") signups = n;
  }
  return { clicks, signups };
}

/** best-effort code assign from user.create.after */
export async function assignReferralCodeOnCreate(
  userId: string,
): Promise<void> {
  try {
    await ensureUserReferralCode(userId);
  } catch (err) {
    console.error("[invoicey] assignReferralCodeOnCreate failed", err);
  }
}
