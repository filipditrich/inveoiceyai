import {
  UnauthenticatedError,
  withAuthChallenges,
  type AuthFn,
} from "eve/channels/auth";

import { resolveWebSessionPrincipal, tryCreateDbFromEnv } from "@invoicey/db";

import type { MeteringAuth } from "./metering-identity";
import { appOrigin } from "./slack-thread";

/**
 * Browser-session auth for the Eve channel.
 *
 * The in-app assistant is the same agent as Slack, reached over the same
 * `/eve/v1/*` routes. It cannot use `lib/auth/session.ts` — that is
 * `server-only` and reads `next/headers`, while Eve runs as its own service —
 * so the cookie the browser already sends is resolved directly against Better
 * Auth's tables. Everything the tools need rides on `attributes`, which is what
 * `tool-workspace.ts` already reads for non-Slack sessions.
 */
export const WEB_AUTHENTICATOR = "invoicey-web";

/** Better Auth's default cookie, plus the `__Secure-` variant it uses on HTTPS. */
const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

/** Slack sessions are `slack:*`; browser ones are `web:<users.id>`. */
export function isWebSession(auth: MeteringAuth | null | undefined): boolean {
  if (!auth) return false;
  if (auth.authenticator === WEB_AUTHENTICATOR) return true;
  return (auth.principalId ?? "").startsWith("web:");
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    return value.length > 0 ? decodeURIComponent(value) : null;
  }
  return null;
}

/** Better Auth stores the cookie as `<token>.<signature>`; the row keys on the token. */
export function sessionCookieFrom(
  request: Request,
): { token: string; signature: string | null } | null {
  const header = request.headers.get("cookie");
  for (const name of SESSION_COOKIE_NAMES) {
    const raw = readCookie(header, name);
    if (!raw) continue;
    const dot = raw.indexOf(".");
    const token = dot > 0 ? raw.slice(0, dot) : raw;
    if (token.length === 0) continue;
    return { token, signature: dot > 0 ? raw.slice(dot + 1) : null };
  }
  return null;
}

let warnedMissingSecret = false;

/**
 * Defence in depth on the cookie's HMAC.
 *
 * The session token is itself the credential — it is the key the session row is
 * looked up by, so a forged signature cannot conjure a session that does not
 * exist. Checking the signature anyway rejects tampered cookies before they
 * reach the database, matching what Better Auth's own reader does.
 *
 * When no secret is configured in this runtime the check is skipped rather than
 * failing closed: the database lookup is the authoritative one, and refusing
 * every browser session over a missing env var would be a worse failure than
 * the one this guards against. It warns once so the gap is visible.
 */
export async function cookieSignatureValid(
  token: string,
  signature: string | null,
): Promise<boolean> {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn(
        "[invoicey-agent] BETTER_AUTH_SECRET is not set here; browser session cookies are accepted on their token alone.",
      );
    }
    return true;
  }
  if (!signature) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(token));
    /**
     * Session cookies go through Better Auth `makeSignature`, which is
     * standard `btoa` of HMAC-SHA256. The session-data cache uses
     * base64url-nopad; that is a different cookie and a different string.
     */
    return timingSafeEqual(
      bytesToStandardBase64(new Uint8Array(mac)),
      signature,
    );
  } catch {
    return false;
  }
}

/** HMAC digest as Better Auth `makeSignature` writes on `session_token`. */
export function bytesToStandardBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Cookie auth is ambient, so a cross-site POST would otherwise drive the agent
 * on a signed-in user's behalf. Same-origin is required before the cookie is
 * even looked up; requests with no `Origin` at all (curl, server-to-server)
 * fall through to the bearer strategies instead of being trusted here.
 */
function configuredOrigins(): string[] {
  const origins = [appOrigin()];
  const authUrl = process.env.BETTER_AUTH_URL?.replace(/\/$/u, "");
  if (authUrl && !origins.includes(authUrl)) origins.push(authUrl);
  return origins;
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (configuredOrigins().includes(origin)) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function browserSession(): AuthFn<Request> {
  return withAuthChallenges(async (request) => {
    if (!isSameOrigin(request)) return null;

    const cookie = sessionCookieFrom(request);
    if (!cookie) return null;
    if (!(await cookieSignatureValid(cookie.token, cookie.signature))) {
      console.warn(
        "[invoicey-agent] browser session cookie signature rejected",
      );
      return null;
    }

    const database = tryCreateDbFromEnv();
    if (!database) return null;

    const resolved = await resolveWebSessionPrincipal(database, {
      sessionToken: cookie.token,
    });

    if (resolved.status === "anonymous") return null;
    if (resolved.status === "no_workspace") {
      /**
       * A valid session with no workspace is a dead end the bearer strategies
       * cannot rescue, and silently falling through would surface as a bare
       * 401 in the chat. Fail with something the UI can explain.
       */
      throw new UnauthenticatedError({
        code: "no_workspace",
        message:
          "This account has no active Invoicey workspace. Pick or create one, then reopen the assistant.",
      });
    }

    const { principal } = resolved;
    return {
      authenticator: WEB_AUTHENTICATOR,
      principalId: `web:${principal.userId}`,
      principalType: "user",
      attributes: {
        workspaceId: principal.workspaceId,
        userId: principal.userId,
        userEmail: principal.email,
        userName: principal.name,
        surface: "web",
      },
    };
  }, []);
}
