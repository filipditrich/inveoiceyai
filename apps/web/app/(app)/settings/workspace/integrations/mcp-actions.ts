"use server";
import { requireWorkspace } from "@/lib/auth/session";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  mcpOauthAccessToken,
  mcpOauthConsent,
  mcpOauthRefreshToken,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
export async function disconnectMcp(form: FormData) {
  const { userId, workspaceId } = await requireWorkspace();
  const id = z.string().parse(form.get("id"));
  const [consent] = await db
    .select()
    .from(mcpOauthConsent)
    .where(
      and(
        eq(mcpOauthConsent.id, id),
        eq(mcpOauthConsent.userId, userId),
        eq(mcpOauthConsent.referenceId, workspaceId),
      ),
    )
    .limit(1);
  if (!consent) return;
  await db.batch([
    db
      .delete(mcpOauthAccessToken)
      .where(
        and(
          eq(mcpOauthAccessToken.userId, userId),
          eq(mcpOauthAccessToken.clientId, consent.clientId),
          eq(mcpOauthAccessToken.referenceId, workspaceId),
        ),
      ),
    db
      .delete(mcpOauthRefreshToken)
      .where(
        and(
          eq(mcpOauthRefreshToken.userId, userId),
          eq(mcpOauthRefreshToken.clientId, consent.clientId),
          eq(mcpOauthRefreshToken.referenceId, workspaceId),
        ),
      ),
    db
      .delete(mcpOauthConsent)
      .where(
        and(
          eq(mcpOauthConsent.clientId, consent.clientId),
          eq(mcpOauthConsent.userId, userId),
          eq(mcpOauthConsent.referenceId, workspaceId),
        ),
      ),
  ]);
  revalidatePath("/settings/workspace/integrations");
}
