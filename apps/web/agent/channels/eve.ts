import { getDefaultWorkspaceId } from "@invoicey/db";
import {
  extractBearerToken,
  localDev,
  vercelOidc,
  withAuthChallenges,
  type AuthFn,
} from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

/**
 * Ops env key inline (channel graph must stay free of `server-only`).
 * User PAT via dynamic import so Eve authored-module evaluate does not pull
 * `@/lib/auth/auth` into a client boundary.
 */
function apiKeyAuth(): AuthFn<Request> {
  return withAuthChallenges(
    async (request) => {
      const token = extractBearerToken(request.headers.get("authorization"));
      if (!token) return null;

      const opsKeys = [
        process.env.EVE_API_KEY?.trim(),
        process.env.MCP_API_KEY?.trim(),
      ].filter((k): k is string => Boolean(k));

      for (const key of opsKeys) {
        if (token === key) {
          const attributes: Record<string, string> = {
            workspaceId: getDefaultWorkspaceId(),
            kind: "ops",
          };
          return {
            authenticator: "api-key",
            principalId: "eve:ops-api-key",
            principalType: "service",
            attributes,
          };
        }
      }

      try {
        const { resolveMachineBearer } =
          await import("@/lib/auth/machine-bearer");
        const identity = await resolveMachineBearer(token, { opsKeys: [] });
        if (!identity || identity.kind !== "user") return null;
        const attributes: Record<string, string> = {
          workspaceId: identity.workspaceId,
          kind: "user",
          userId: identity.userId,
        };
        return {
          authenticator: "api-key",
          principalId: identity.userId,
          principalType: "user",
          attributes,
        };
      } catch {
        return null;
      }
    },
    [{ scheme: "Bearer" }],
  );
}

export default eveChannel({
  auth: [apiKeyAuth(), vercelOidc(), localDev()],
});
