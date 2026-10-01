import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { APIError } from "better-auth/api";
import { jwt } from "better-auth/plugins";
import { createLocalJWKSet, jwtVerify } from "jose";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { mcpOAuthOptions } from "./oauth-options";

const origin = "http://localhost:3121";
const redirectUri = "https://chatgpt.com/connector_platform_oauth_redirect";
async function fixture() {
  let selectedWorkspace = "workspace-a";
  const members = new Set(["workspace-a", "workspace-b"]);
  const auth = betterAuth({
    baseURL: origin,
    secret: "test-only-secret-with-at-least-32-characters",
    database: memoryAdapter({
      user: [],
      account: [],
      session: [],
      verification: [],
      jwks: [],
      oauthClient: [],
      oauthConsent: [],
      oauthAccessToken: [],
      oauthRefreshToken: [],
    }),
    emailAndPassword: { enabled: true },
    disabledPaths: ["/token"],
    plugins: [
      jwt({
        jwt: { issuer: `${origin}/api/auth`, audience: `${origin}/api/mcp` },
      }),
      oauthProvider(
        mcpOAuthOptions(
          origin,
          async (_user, workspaceId) => {
            if (!members.has(workspaceId))
              throw new APIError("FORBIDDEN", {
                message: "Membership revoked",
              });
            return workspaceId;
          },
          () => selectedWorkspace,
        ),
      ),
    ],
  });
  const signUp = await auth.api.signUpEmail({
    body: {
      email: "mcp@example.test",
      password: "only-for-isolated-test-9281",
      name: "MCP test",
    },
    asResponse: true,
  });
  const cookie = signUp.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  async function request(
    path: string,
    body?: URLSearchParams | { [key: string]: string | boolean | string[] },
    authenticated = false,
    _form = false,
  ) {
    const requestHeaders = new Headers({ accept: "application/json", origin });
    if (authenticated) requestHeaders.set("cookie", cookie);
    if (body)
      requestHeaders.set(
        "Content-Type",
        body instanceof URLSearchParams
          ? "application/x-www-form-urlencoded"
          : "application/json",
      );
    const response = await auth.handler(
      new Request(`${origin}/api/auth${path}`, {
        method: body ? "POST" : "GET",
        headers: requestHeaders,
        body:
          body instanceof URLSearchParams
            ? body.toString()
            : body
              ? JSON.stringify(body)
              : undefined,
      }),
    );
    return { status: response.status, body: await response.json() };
  }
  const registration = await request("/oauth2/register", {
    client_name: "Invoicey protocol test",
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "invoicey:read invoicey:write offline_access",
  });
  expect(registration.status).toBe(200);
  const verifier = "a-secure-test-verifier-long-enough-to-satisfy-pkce-9281271";
  const params = new URLSearchParams({
    client_id: registration.body.client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    scope: "invoicey:read invoicey:write offline_access",
    resource: `${origin}/api/mcp`,
    state: "test-state",
  });
  async function authorize() {
    const response = await request(
      `/oauth2/authorize?${params}`,
      undefined,
      true,
    );
    expect(response.status).toBe(200);
    const consentUrl = new URL(response.body.url, origin);
    const consent = await request(
      "/oauth2/consent",
      { accept: true, oauth_query: consentUrl.search.slice(1) },
      true,
    );
    expect(consent.status).toBe(200);
    return new URL(consent.body.url).searchParams.get("code")!;
  }
  async function token(code: string, proof = verifier) {
    return request(
      "/oauth2/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: registration.body.client_id,
        redirect_uri: redirectUri,
        code_verifier: proof,
        resource: `${origin}/api/mcp`,
      }),
      false,
      true,
    );
  }
  return {
    auth,
    request,
    params,
    authorize,
    token,
    verifier,
    clientId: registration.body.client_id,
    select: (id: string) => {
      selectedWorkspace = id;
    },
    members,
  };
}
describe("workspace-bound OAuth protocol", () => {
  it("exchanges S256 consent and keeps the approved workspace when the web selection changes before refresh", async () => {
    const f = await fixture();
    const token = await f.token(await f.authorize());
    expect(token.status).toBe(200);
    const jwks = await f.request("/jwks");
    const keys = createLocalJWKSet(jwks.body);
    const first = await jwtVerify(token.body.access_token, keys, {
      issuer: `${origin}/api/auth`,
      audience: `${origin}/api/mcp`,
    });
    expect(first.payload.workspace_id).toBe("workspace-a");
    expect(first.payload.sid).toEqual(expect.any(String));
    f.select("workspace-b");
    const refresh = await f.request(
      "/oauth2/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.body.refresh_token,
        client_id: f.clientId,
        resource: `${origin}/api/mcp`,
      }),
      false,
      true,
    );
    expect(refresh.status).toBe(200);
    expect(
      (
        await jwtVerify(refresh.body.access_token, keys, {
          audience: `${origin}/api/mcp`,
        })
      ).payload.workspace_id,
    ).toBe("workspace-a");
    await expect(
      jwtVerify(refresh.body.access_token, keys, {
        audience: "https://other-service.test",
      }),
    ).rejects.toThrow();
  });
  it("rejects a wrong PKCE verifier before issuing tokens", async () => {
    const f = await fixture();
    const result = await f.token(
      await f.authorize(),
      "the-wrong-verifier-still-long-enough-for-pkce-9281271",
    );
    expect(result.status).toBe(401);
    expect(result.body.access_token).toBeUndefined();
  });
  it("rejects a tampered signed consent query", async () => {
    const f = await fixture();
    const response = await f.request(
      `/oauth2/authorize?${f.params}`,
      undefined,
      true,
    );
    const query = new URL(response.body.url, origin).searchParams;
    query.set("redirect_uri", "https://attacker.example/callback");
    const denied = await f.request(
      "/oauth2/consent",
      { accept: true, oauth_query: query.toString() },
      true,
    );
    expect(denied.status).toBeGreaterThanOrEqual(400);
    expect(denied.body.url).toBeUndefined();
  });
  it("cannot exchange an authorization code twice", async () => {
    const f = await fixture();
    const code = await f.authorize();
    expect((await f.token(code)).status).toBe(200);
    const replay = await f.token(code);
    expect(replay.status).toBeGreaterThanOrEqual(400);
    expect(replay.body.access_token).toBeUndefined();
  });
  it("does not issue a code when consent is denied", async () => {
    const f = await fixture();
    const response = await f.request(
      `/oauth2/authorize?${f.params}`,
      undefined,
      true,
    );
    const query = new URL(response.body.url, origin).search.slice(1);
    const denial = await f.request(
      "/oauth2/consent",
      { accept: false, oauth_query: query },
      true,
    );
    const callback = new URL(denial.body.url);
    expect(callback.searchParams.get("error")).toBe("access_denied");
    expect(callback.searchParams.get("code")).toBeNull();
  });
  it("does not renew workspace access after membership is removed", async () => {
    const f = await fixture();
    const token = await f.token(await f.authorize());
    f.members.delete("workspace-a");
    const refresh = await f.request(
      "/oauth2/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.body.refresh_token,
        client_id: f.clientId,
        resource: `${origin}/api/mcp`,
      }),
      false,
      true,
    );
    expect(refresh.status).toBeGreaterThanOrEqual(400);
    expect(refresh.body.access_token).toBeUndefined();
  });
});
