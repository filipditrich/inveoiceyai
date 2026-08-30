import {
  extractBearerToken,
  localDev,
  vercelOidc,
  withAuthChallenges,
  type AuthFn,
} from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

import { browserSession } from "../lib/web-identity";

/**
 * Eve authored-module evaluate treats this file as a client boundary, so it
 * must not import `server-only` (or anything that does). Ops bearer only here;
 * user PATs stay on remote MCP via `machine-bearer`.
 */
function apiKeyAuth(): AuthFn<Request> {
  return withAuthChallenges(
    (request) => {
      const expected =
        process.env.EVE_API_KEY?.trim() || process.env.MCP_API_KEY?.trim();
      if (!expected) return null;
      const token = extractBearerToken(request.headers.get("authorization"));
      if (!token || token !== expected) return null;

      const workspaceId =
        process.env.INVOICEY_DEFAULT_WORKSPACE_ID?.trim() ||
        "00000000-0000-4000-8000-000000000001";

      return {
        authenticator: "api-key",
        principalId: "eve:ops-api-key",
        principalType: "service",
        attributes: {
          workspaceId,
          kind: "ops",
        },
      };
    },
    [{ scheme: "Bearer" }],
  );
}

/**
 * `browserSession()` comes first: the in-app assistant is the only caller that
 * arrives with a cookie and a same-origin `Origin`, and resolving it here keeps
 * the web surface on the same agent, tools and HITL loop as Slack. Everything
 * else still falls through to the bearer/OIDC strategies, and an unknown caller
 * still gets a 401.
 */
export default eveChannel({
  auth: [browserSession(), apiKeyAuth(), vercelOidc(), localDev()],
});
