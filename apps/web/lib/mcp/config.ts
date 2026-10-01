import { env } from "@invoicey/env/server";
export const MCP_ORIGIN = (
  env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL
).replace(/\/$/, "");
export const MCP_RESOURCE = `${MCP_ORIGIN}/api/mcp`;
export const MCP_ISSUER = `${MCP_ORIGIN}/api/auth`;
export const MCP_SCOPES = ["invoicey:read", "invoicey:write", "offline_access"];
export const MCP_RESOURCE_METADATA = `${MCP_ORIGIN}/.well-known/oauth-protected-resource/api/mcp`;
export function mcpChallenge(error = "invalid_token") {
  return `Bearer resource_metadata="${MCP_RESOURCE_METADATA}", error="${error}", error_description="Connect Invoicey and approve access to your workspace"`;
}
