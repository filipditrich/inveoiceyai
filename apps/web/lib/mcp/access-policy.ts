import { z } from "zod";

import {
  MCP_TOOL_PERMISSIONS,
  mcpToolPolicy,
} from "@invoicey/invoice-tools/mcp-policy";

import type { JWTPayload } from "jose";
export function toolAccessError(
  toolName: string,
  scopes: readonly string[],
  permissions: ReadonlySet<string>,
): string | null {
  const permission = MCP_TOOL_PERMISSIONS[toolName];
  if (!permission || !permissions.has(permission)) return "forbidden";
  if (!scopes.includes(mcpToolPolicy(toolName).scope))
    return "insufficient_scope";
  return null;
}
const IdentityClaims = z.object({
  sub: z.string().min(1),
  workspace_id: z.string().min(1),
  azp: z.string().min(1),
  sid: z.string().min(1),
  scope: z.string(),
});
export function oauthIdentity(claims: JWTPayload) {
  const parsed = IdentityClaims.safeParse(claims);
  if (!parsed.success) return null;
  const identity = parsed.data;
  return {
    userId: identity.sub,
    workspaceId: identity.workspace_id,
    clientId: identity.azp,
    sessionId: identity.sid,
    scopes: identity.scope.split(" "),
  };
}
