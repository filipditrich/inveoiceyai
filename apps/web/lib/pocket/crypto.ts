import { hashDeviceTokenWithSecret } from "@/lib/auth/device-trust-crypto";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const PKCE_UNRESERVED = /^[A-Za-z0-9\-._~]{43,128}$/u;

export function generatePocketPairCode(): string {
  return randomBytes(32).toString("base64url");
}

export function generatePocketDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPocketSecret(secret: string, value: string): string {
  return hashDeviceTokenWithSecret(secret, value);
}

export function pocketTokenFingerprint(tokenHash: string): string {
  return tokenHash.slice(0, 8);
}

export function pocketPkceS256Challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function isPocketPkceChallenge(raw: string): boolean {
  return PKCE_UNRESERVED.test(raw);
}

export function verifyPocketPkceS256(input: {
  verifier: string;
  challenge: string;
}): boolean {
  if (
    !PKCE_UNRESERVED.test(input.verifier) ||
    !isPocketPkceChallenge(input.challenge)
  ) {
    return false;
  }
  const expected = Buffer.from(pocketPkceS256Challenge(input.verifier));
  const actual = Buffer.from(input.challenge);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
