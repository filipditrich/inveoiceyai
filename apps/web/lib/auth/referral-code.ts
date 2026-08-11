import { randomBytes } from "node:crypto";

/** Url-safe personal referral code (no DB dependency — unit-testable). */
export function newReferralCode(): string {
  return randomBytes(6).toString("base64url");
}
