import { createHmac, timingSafeEqual } from "node:crypto";

const TRUST_TOKEN_TTL_MS = 1000 * 60 * 60 * 48;

type TrustTokenPayload = {
  u: string;
  d: string;
  exp: number;
};

function b64url(data: string | Buffer): string {
  return Buffer.from(data).toString("base64url");
}

function signPayload(secret: string, payloadB64: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function hashDeviceTokenWithSecret(
  secret: string,
  rawToken: string,
): string {
  return createHmac("sha256", secret).update(rawToken).digest("hex");
}

export function createTrustTokenWithSecret(
  secret: string,
  opts: { userId: string; rawDeviceToken: string },
): string {
  const payload: TrustTokenPayload = {
    u: opts.userId,
    d: opts.rawDeviceToken,
    exp: Date.now() + TRUST_TOKEN_TTL_MS,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = signPayload(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifyTrustTokenWithSecret(
  secret: string,
  token: string,
): TrustTokenPayload | null {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const expected = signPayload(secret, payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as TrustTokenPayload;
    if (
      typeof payload.u !== "string" ||
      typeof payload.d !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
