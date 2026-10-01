import { z } from "zod";

import type { OAuthOptions } from "@better-auth/oauth-provider";
export function mcpOAuthOptions(
  origin: string,
  workspace: (userId: string, workspaceId: string) => Promise<string>,
  selectedWorkspace: () => string | undefined,
): OAuthOptions<string[]> {
  const scopes = ["invoicey:read", "invoicey:write", "offline_access"];
  return {
    loginPage: "/mcp/connect/login",
    consentPage: "/mcp/connect/consent",
    scopes,
    validAudiences: [`${origin}/api/mcp`],
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    clientRegistrationDefaultScopes: scopes,
    grantTypes: ["authorization_code", "refresh_token"],
    accessTokenExpiresIn: 900,
    postLogin: {
      page: "/mcp/connect/workspace",
      shouldRedirect: async () => false,
      consentReferenceId: async ({ user, session }) =>
        workspace(
          user.id,
          z.string().parse(selectedWorkspace() ?? session.activeOrganizationId),
        ),
    },
    customAccessTokenClaims: async ({ user, referenceId }) => ({
      workspace_id: await workspace(
        z.string().parse(user?.id),
        z.string().parse(referenceId),
      ),
    }),
  };
}
