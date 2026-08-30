import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  cookieSignatureValid,
  isWebSession,
  sessionCookieFrom,
  WEB_AUTHENTICATOR,
} from "./web-identity";

const SECRET = "test-secret-value-at-least-32-chars-long";
const TOKEN = "yKq7Xn2fZ0aB3cD4eF5gH6iJ7kL8mN9o";

function requestWithCookie(cookie: string): Request {
  return new Request("http://localhost:3000/eve/v1/session", {
    headers: { cookie },
  });
}

/** The signature Better Auth writes: base64 of HMAC-SHA256(secret, token). */
async function sign(token: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(token));
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

describe("sessionCookieFrom", () => {
  it("splits the token from its signature", () => {
    const cookie = sessionCookieFrom(
      requestWithCookie(`better-auth.session_token=${TOKEN}.abc123`),
    );
    expect(cookie).toEqual({ token: TOKEN, signature: "abc123" });
  });

  it("reads the __Secure- variant used over HTTPS", () => {
    const cookie = sessionCookieFrom(
      requestWithCookie(`__Secure-better-auth.session_token=${TOKEN}.abc123`),
    );
    expect(cookie?.token).toBe(TOKEN);
  });

  it("ignores unrelated cookies", () => {
    expect(
      sessionCookieFrom(requestWithCookie("NEXT_LOCALE=cs; theme=dark")),
    ).toBeNull();
  });

  it("returns no signature when the cookie carries only a token", () => {
    const cookie = sessionCookieFrom(
      requestWithCookie(`better-auth.session_token=${TOKEN}`),
    );
    expect(cookie).toEqual({ token: TOKEN, signature: null });
  });
});

describe("cookieSignatureValid", () => {
  const original = process.env.BETTER_AUTH_SECRET;

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = SECRET;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = original;
  });

  it("accepts a signature produced with the configured secret", async () => {
    await expect(
      cookieSignatureValid(TOKEN, await sign(TOKEN, SECRET)),
    ).resolves.toBe(true);
  });

  it("rejects a signature from a different secret", async () => {
    await expect(
      cookieSignatureValid(TOKEN, await sign(TOKEN, "some-other-secret")),
    ).resolves.toBe(false);
  });

  it("rejects a signature for a different token", async () => {
    await expect(
      cookieSignatureValid(TOKEN, await sign("another-token", SECRET)),
    ).resolves.toBe(false);
  });

  it("rejects a cookie with no signature at all", async () => {
    await expect(cookieSignatureValid(TOKEN, null)).resolves.toBe(false);
    await expect(cookieSignatureValid(TOKEN, "sig")).resolves.toBe(false);
  });

  /**
   * The database lookup is the authoritative check, so a runtime without the
   * secret still authenticates rather than locking every browser session out.
   */
  it("skips the check when no secret is configured", async () => {
    delete process.env.BETTER_AUTH_SECRET;
    await expect(cookieSignatureValid(TOKEN, "anything")).resolves.toBe(true);
  });
});

describe("isWebSession", () => {
  it("recognises the browser principal", () => {
    expect(
      isWebSession({
        authenticator: WEB_AUTHENTICATOR,
        principalId: "web:user_1",
      }),
    ).toBe(true);
  });

  it("does not claim Slack or machine sessions", () => {
    expect(
      isWebSession({
        authenticator: "slack-webhook",
        principalId: "slack:T1:U1",
      }),
    ).toBe(false);
    expect(
      isWebSession({
        authenticator: "api-key",
        principalId: "eve:ops-api-key",
      }),
    ).toBe(false);
    expect(isWebSession(null)).toBe(false);
  });
});
