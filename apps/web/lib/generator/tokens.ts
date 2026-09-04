import { env } from "@/env.config.server";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, stateless tokens for the free invoice generator (ADR 0048 §5).
 *
 * A guest has no session, so the two things they may still do after leaving the
 * page — download the PDF again from the invoice mail, and claim the workspace
 * — are authorised by an HMAC over the workspace and invoice ids. Nothing is
 * stored: the token *is* the grant, and it expires with the retention window.
 */
export type GuestTokenPurpose = "claim" | "download";

const TTL_MS: Record<GuestTokenPurpose, number> = {
  /** Matches the 12-month guest retention window (ADR 0048 §8). */
  claim: 1000 * 60 * 60 * 24 * 366,
  download: 1000 * 60 * 60 * 24 * 366,
};

export type GuestTokenPayload = {
  /** Purpose, so a download link can never be replayed as a claim. */
  p: GuestTokenPurpose;
  /** Guest workspace id. */
  w: string;
  /** Issued invoice id. */
  i: string;
  /** Normalized guest email the token was minted for. */
  e: string;
  exp: number;
};

export type GuestTokenInput = {
  purpose: GuestTokenPurpose;
  workspaceId: string;
  invoiceId: string;
  email: string;
};

/** Thrown when the signing secret is absent — the caller should fail closed. */
export class GuestTokenSecretMissingError extends Error {
  constructor() {
    super("BETTER_AUTH_SECRET is required to sign guest tokens");
    this.name = "GuestTokenSecretMissingError";
  }
}

function sign(secret: string, purpose: GuestTokenPurpose, payloadB64: string) {
  // Domain separation: the purpose is inside the MAC, not just the payload.
  return createHmac("sha256", `${secret}:guest:${purpose}`)
    .update(payloadB64)
    .digest("base64url");
}

export function signGuestTokenWithSecret(
  secret: string,
  input: GuestTokenInput,
  now = Date.now(),
): string {
  const payload: GuestTokenPayload = {
    p: input.purpose,
    w: input.workspaceId,
    i: input.invoiceId,
    e: input.email,
    exp: now + TTL_MS[input.purpose],
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(secret, input.purpose, payloadB64)}`;
}

export function verifyGuestTokenWithSecret(
  secret: string,
  token: string,
  purpose: GuestTokenPurpose,
  now = Date.now(),
): GuestTokenPayload | null {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(secret, purpose, payloadB64));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as GuestTokenPayload;
    if (
      payload.p !== purpose ||
      typeof payload.w !== "string" ||
      typeof payload.i !== "string" ||
      typeof payload.e !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp < now
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function requireSecret(): string {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) throw new GuestTokenSecretMissingError();
  return secret;
}

/** @throws GuestTokenSecretMissingError when the app has no signing secret. */
export function signGuestToken(input: GuestTokenInput): string {
  return signGuestTokenWithSecret(requireSecret(), input);
}

/** Returns `null` for a tampered, expired, or wrong-purpose token. */
export function verifyGuestToken(
  token: string,
  purpose: GuestTokenPurpose,
): GuestTokenPayload | null {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) return null;
  return verifyGuestTokenWithSecret(secret, token, purpose);
}
