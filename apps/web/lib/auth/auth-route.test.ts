import { beforeEach, describe, expect, it, vi } from "vitest";

const botCheck = vi.hoisted(() => vi.fn());
vi.mock("botid/server", () => ({ checkBotId: botCheck }));
vi.mock("@/lib/auth/auth", async () => {
  const { betterAuth } = await import("better-auth");
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  const { jwt } = await import("better-auth/plugins");
  const { oauthProvider } = await import("@better-auth/oauth-provider");
  const { mcpOAuthOptions } = await import("../mcp/oauth-options");
  return {
    auth: betterAuth({
      baseURL: "https://invoicey.test",
      secret: "auth-route-test-secret-at-least-32-characters",
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
      plugins: [
        jwt(),
        oauthProvider(
          mcpOAuthOptions(
            "https://invoicey.test",
            async (_user, workspace) => workspace,
            () => undefined,
          ),
        ),
      ],
    }),
  };
});

import { POST } from "@/app/api/auth/[...all]/route";

function post(path: string, body: Record<string, string | string[]>) {
  return POST(
    new Request(`https://invoicey.test/api/auth${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  botCheck.mockReset();
  botCheck.mockResolvedValue({ isBot: true });
});

describe("auth route machine clients", () => {
  it("registers a public OAuth client without browser BotID headers", async () => {
    const response = await post("/oauth2/register", {
      client_name: "ChatGPT route regression",
      redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "invoicey:read invoicey:write offline_access",
    });
    expect(response.status).toBe(200);
    const client = await response.json();
    expect(client.client_id).toEqual(expect.any(String));
    expect(botCheck).not.toHaveBeenCalled();
  });

  it.each(["token", "introspect", "revoke"])(
    "lets the OAuth provider reject invalid %s credentials",
    async (endpoint) => {
      const response = await post(`/oauth2/${endpoint}`, {
        client_id: "unknown-client",
        token: "invalid",
        grant_type: "refresh_token",
        refresh_token: "invalid",
      });
      expect(botCheck).not.toHaveBeenCalled();
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expect(await response.json()).not.toEqual({ error: "Access denied" });
    },
  );

  it.each([
    "/sign-in/social",
    "/oauth2/consent",
    "/oauth2/register/extra",
    "/oauth2/token-evil",
  ])("continues blocking bots on %s", async (path) => {
    const response = await post(path, {});
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Access denied" });
    expect(botCheck).toHaveBeenCalledOnce();
  });
});
