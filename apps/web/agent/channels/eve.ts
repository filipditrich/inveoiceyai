import {
  extractBearerToken,
  localDev,
  vercelOidc,
  withAuthChallenges,
  type AuthFn,
} from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

/** Bearer `EVE_API_KEY` or `MCP_API_KEY` for HTTP `/eve/v1/*`. */
function apiKeyAuth(): AuthFn<Request> {
  return withAuthChallenges((request) => {
    const expected =
      process.env.EVE_API_KEY?.trim() || process.env.MCP_API_KEY?.trim();
    if (!expected) return null;
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token || token !== expected) return null;
    return {
      authenticator: "api-key",
      principalId: "eve:api-key",
      principalType: "service",
      attributes: {},
    };
  }, [{ scheme: "Bearer" }]);
}

export default eveChannel({
  auth: [apiKeyAuth(), vercelOidc(), localDev()],
});
