import {
  extractBearerToken,
  localDev,
  vercelOidc,
  withAuthChallenges,
  type AuthFn,
} from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

import { resolveMachineBearer } from "@/lib/auth/machine-bearer";

/** Ops env key or Better Auth user PAT; PAT sets workspaceId on principal attrs. */
function apiKeyAuth(): AuthFn<Request> {
  return withAuthChallenges(
    async (request) => {
      const token = extractBearerToken(request.headers.get("authorization"));
      const identity = await resolveMachineBearer(token, {
        opsKeys: [
          process.env.EVE_API_KEY?.trim(),
          process.env.MCP_API_KEY?.trim(),
        ],
      });
      if (!identity) return null;

      const attributes: Record<string, string> = {
        workspaceId: identity.workspaceId,
        kind: identity.kind,
      };
      if (identity.kind === "user") {
        attributes.userId = identity.userId;
      }

      return {
        authenticator: "api-key",
        principalId:
          identity.kind === "ops" ? "eve:ops-api-key" : identity.userId,
        principalType: identity.kind === "ops" ? "service" : "user",
        attributes,
      };
    },
    [{ scheme: "Bearer" }],
  );
}

export default eveChannel({
  auth: [apiKeyAuth(), vercelOidc(), localDev()],
});
