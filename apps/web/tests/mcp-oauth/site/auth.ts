import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";

import { getInvoiceyRequestContext } from "@invoicey/invoice-tools/workspace-context";

import { mcpOAuthOptions } from "../../../lib/mcp/oauth-options";
const origin = "http://localhost:3123";
// This separate Next application is never part of the production route tree.
const tables = {
  user: [],
  account: [],
  session: [],
  verification: [],
  jwks: [],
  oauthClient: [],
  oauthConsent: [],
  oauthAccessToken: [],
  oauthRefreshToken: [],
};
// SAFETY: the isolated dev server shares its in-memory database across route bundles.
const store = globalThis as typeof globalThis & {
  oauthBrowserTables?: typeof tables;
};
function createAuth() {
  return betterAuth({
    baseURL: origin,
    secret: "isolated-oauth-browser-secret-32-characters",
    database: memoryAdapter((store.oauthBrowserTables ??= tables)),
    emailAndPassword: { enabled: true },
    session: {
      additionalFields: {
        activeOrganizationId: { type: "string", defaultValue: "workspace-a" },
      },
    },
    plugins: [
      jwt({
        jwt: { issuer: origin + "/api/auth", audience: origin + "/api/mcp" },
      }),
      oauthProvider({
        ...mcpOAuthOptions(
          origin,
          async (_user, workspace) => workspace,
          () => getInvoiceyRequestContext()?.workspaceId,
        ),
        rateLimit: { register: false },
      }),
      nextCookies(),
    ],
  });
}
export const auth = createAuth();
