import { hashDeviceTokenWithSecret } from "@/lib/auth/device-trust-crypto";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const PKCE_UNRESERVED = /^[A-Za-z0-9\-._~]{43,128}$/;

export function generateDrivePairCode(): string {
  return randomBytes(32).toString("base64url");
}

export function generateDriveDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashDriveSecret(secret: string, value: string): string {
  return hashDeviceTokenWithSecret(secret, value);
}

export function driveTokenFingerprint(tokenHash: string): string {
  return tokenHash.slice(0, 8);
}

/** RFC 7636 S256: BASE64URL(SHA256(ASCII(verifier))). */
export function pkceS256Challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function isPkceVerifier(raw: string): boolean {
  return PKCE_UNRESERVED.test(raw);
}

export function isPkceChallenge(raw: string): boolean {
  return PKCE_UNRESERVED.test(raw);
}

export function verifyPkceS256(input: {
  verifier: string;
  challenge: string;
}): boolean {
  if (!isPkceVerifier(input.verifier) || !isPkceChallenge(input.challenge)) {
    return false;
  }
  const expected = pkceS256Challenge(input.verifier);
  const a = Buffer.from(expected);
  const b = Buffer.from(input.challenge);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
