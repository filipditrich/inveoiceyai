import "server-only";
import { resolveMachineBearer } from "@/lib/auth/machine-bearer";
import { PERMISSIONS } from "@/lib/authz/catalog";
import { verifyAccessToken } from "better-auth/oauth2";
import { and, eq, gt } from "drizzle-orm";

import { mcpOauthClient, mcpOauthConsent, session } from "@invoicey/db";
import { db } from "@invoicey/db/client";

import { oauthIdentity } from "./access-policy";
import { MCP_ISSUER, MCP_RESOURCE } from "./config";
import { mcpMembership } from "./membership";

export async function authenticateMcp(token: string) {
  if (token.split(".").length === 3) {
    try {
      const claims = await verifyAccessToken(token, {
        jwksUrl: `${MCP_ISSUER}/jwks`,
        verifyOptions: { issuer: MCP_ISSUER, audience: MCP_RESOURCE },
      });
      const identity = oauthIdentity(claims);
      if (!identity) return null;
      const [consent] = await db
        .select({ scopes: mcpOauthConsent.scopes })
        .from(mcpOauthConsent)
        .innerJoin(
          mcpOauthClient,
          eq(mcpOauthClient.clientId, mcpOauthConsent.clientId),
        )
        .where(
          and(
            eq(mcpOauthConsent.clientId, identity.clientId),
            eq(mcpOauthConsent.userId, identity.userId),
            eq(mcpOauthConsent.referenceId, identity.workspaceId),
            eq(mcpOauthClient.disabled, false),
          ),
        )
        .limit(1);
      const [activeSession] = await db
        .select({ id: session.id })
        .from(session)
        .where(
          and(
            eq(session.id, identity.sessionId),
            eq(session.userId, identity.userId),
            gt(session.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (
        !consent ||
        !activeSession ||
        !identity.scopes.every((scope) => consent.scopes.includes(scope))
      )
        return null;
      const membership = await mcpMembership(
        identity.userId,
        identity.workspaceId,
      );
      return membership
        ? { ...identity, permissions: membership.permissions }
        : null;
    } catch {
      return null;
    }
  }
  const machine = await resolveMachineBearer(token);
  if (!machine) return null;
  if (machine.kind === "ops")
    return {
      ...machine,
      clientId: "ops",
      scopes: ["invoicey:read", "invoicey:write"],
      permissions: new Set(PERMISSIONS),
    };
  const membership = await mcpMembership(machine.userId, machine.workspaceId);
  return membership
    ? {
        ...machine,
        ...membership,
        clientId: machine.userId,
        scopes: ["invoicey:read", "invoicey:write"],
      }
    : null;
}
