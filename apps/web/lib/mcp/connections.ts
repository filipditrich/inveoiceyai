import "server-only";
import { and, eq } from "drizzle-orm";

import { mcpOauthClient, mcpOauthConsent } from "@invoicey/db";
import { db } from "@invoicey/db/client";
export function listMcpConnections(userId: string, workspaceId: string) {
  return db
    .select({
      id: mcpOauthConsent.id,
      name: mcpOauthClient.name,
      scopes: mcpOauthConsent.scopes,
    })
    .from(mcpOauthConsent)
    .innerJoin(
      mcpOauthClient,
      eq(mcpOauthClient.clientId, mcpOauthConsent.clientId),
    )
    .where(
      and(
        eq(mcpOauthConsent.userId, userId),
        eq(mcpOauthConsent.referenceId, workspaceId),
      ),
    );
}
