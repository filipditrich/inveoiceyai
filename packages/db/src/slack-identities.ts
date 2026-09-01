import { and, eq, gt, isNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import { member } from "./auth-schema";
import type { InvoiceyDb } from "./create-db";
import { slackIdentities, slackLinkCodes } from "./schema";
import { workspaces } from "./workspaces";

export const SLACK_LINK_CODE_TTL_MS = 15 * 60 * 1000;

export type SlackIdentityRecord = {
  userId: string;
  workspaceId: string;
  slackTeamId: string;
  slackUserId: string;
};

export type SlackIdentityListItem = SlackIdentityRecord & {
  workspaceName: string;
  createdAt: Date;
};

export type SlackLinkCodeRecord = {
  code: string;
  slackTeamId: string;
  slackUserId: string;
  slackUserName: string | null;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type SlackLinkConfirmDecision = "insert" | "rebind" | "steal_refused";

export type LinkedSlackPrincipal =
  | { status: "unlinked" }
  | { status: "not_member"; identity: SlackIdentityRecord }
  | { status: "linked"; identity: SlackIdentityRecord };

/** URL-safe one-shot code for `/slack/link/[code]`. */
export function generateSlackLinkCode(): string {
  return randomBytes(18).toString("base64url");
}

export function isSlackLinkCodeOpen(
  row: { expiresAt: Date; consumedAt: Date | null },
  now = new Date(),
): boolean {
  if (row.consumedAt != null) return false;
  return row.expiresAt.getTime() > now.getTime();
}

/**
 * Same Invoicey user may rebind workspace. A different user cannot take over
 * the Slack identity until the original unlinks.
 */
export function slackLinkConfirmDecision(input: {
  existingUserId: string | null;
  confirmingUserId: string;
}): SlackLinkConfirmDecision {
  if (!input.existingUserId) return "insert";
  if (input.existingUserId === input.confirmingUserId) return "rebind";
  return "steal_refused";
}

export async function findSlackIdentity(
  db: InvoiceyDb,
  input: { slackTeamId: string; slackUserId: string },
): Promise<SlackIdentityRecord | null> {
  const [row] = await db
    .select({
      userId: slackIdentities.userId,
      workspaceId: slackIdentities.workspaceId,
      slackTeamId: slackIdentities.slackTeamId,
      slackUserId: slackIdentities.slackUserId,
    })
    .from(slackIdentities)
    .where(
      and(
        eq(slackIdentities.slackTeamId, input.slackTeamId),
        eq(slackIdentities.slackUserId, input.slackUserId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listSlackIdentitiesForUser(
  db: InvoiceyDb,
  userId: string,
): Promise<SlackIdentityListItem[]> {
  return db
    .select({
      userId: slackIdentities.userId,
      workspaceId: slackIdentities.workspaceId,
      slackTeamId: slackIdentities.slackTeamId,
      slackUserId: slackIdentities.slackUserId,
      workspaceName: workspaces.name,
      createdAt: slackIdentities.createdAt,
    })
    .from(slackIdentities)
    .innerJoin(workspaces, eq(workspaces.id, slackIdentities.workspaceId))
    .where(eq(slackIdentities.userId, userId));
}

export async function isWorkspaceMember(
  db: InvoiceyDb,
  input: { userId: string; workspaceId: string },
): Promise<boolean> {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.userId, input.userId),
        eq(member.organizationId, input.workspaceId),
      ),
    )
    .limit(1);
  return row != null;
}

export async function resolveLinkedSlackPrincipal(
  db: InvoiceyDb,
  input: { slackTeamId: string; slackUserId: string },
): Promise<LinkedSlackPrincipal> {
  const identity = await findSlackIdentity(db, input);
  if (!identity) return { status: "unlinked" };
  const memberOk = await isWorkspaceMember(db, {
    userId: identity.userId,
    workspaceId: identity.workspaceId,
  });
  if (!memberOk) return { status: "not_member", identity };
  return { status: "linked", identity };
}

export async function createOrReuseSlackLinkCode(
  db: InvoiceyDb,
  input: {
    slackTeamId: string;
    slackUserId: string;
    slackUserName?: string | null;
  },
  now = new Date(),
): Promise<SlackLinkCodeRecord> {
  const existing = await db
    .select()
    .from(slackLinkCodes)
    .where(
      and(
        eq(slackLinkCodes.slackTeamId, input.slackTeamId),
        eq(slackLinkCodes.slackUserId, input.slackUserId),
        isNull(slackLinkCodes.consumedAt),
      ),
    );

  const open = existing.find((row) => isSlackLinkCodeOpen(row, now));
  if (open) {
    const name = input.slackUserName?.trim();
    if (name && name !== open.slackUserName) {
      await db
        .update(slackLinkCodes)
        .set({ slackUserName: name })
        .where(eq(slackLinkCodes.code, open.code));
      return { ...open, slackUserName: name };
    }
    return open;
  }

  const code = generateSlackLinkCode();
  const expiresAt = new Date(now.getTime() + SLACK_LINK_CODE_TTL_MS);
  const slackUserName = input.slackUserName?.trim() || null;
  await db.insert(slackLinkCodes).values({
    code,
    slackTeamId: input.slackTeamId,
    slackUserId: input.slackUserId,
    slackUserName,
    expiresAt,
    createdAt: now,
  });
  return {
    code,
    slackTeamId: input.slackTeamId,
    slackUserId: input.slackUserId,
    slackUserName,
    expiresAt,
    consumedAt: null,
  };
}

export async function getSlackLinkCode(
  db: InvoiceyDb,
  code: string,
): Promise<SlackLinkCodeRecord | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const [row] = await db
    .select()
    .from(slackLinkCodes)
    .where(eq(slackLinkCodes.code, trimmed))
    .limit(1);
  return row ?? null;
}

export async function consumeSlackLinkCode(
  db: InvoiceyDb,
  code: string,
  now = new Date(),
): Promise<SlackLinkCodeRecord | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const [row] = await db
    .update(slackLinkCodes)
    .set({ consumedAt: now })
    .where(
      and(
        eq(slackLinkCodes.code, trimmed),
        isNull(slackLinkCodes.consumedAt),
        gt(slackLinkCodes.expiresAt, now),
      ),
    )
    .returning();
  return row ?? null;
}

export async function getWorkspaceName(
  db: InvoiceyDb,
  workspaceId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return row?.name ?? null;
}

export async function upsertSlackIdentity(
  db: InvoiceyDb,
  input: {
    slackTeamId: string;
    slackUserId: string;
    userId: string;
    workspaceId: string;
  },
  now = new Date(),
): Promise<void> {
  await db
    .insert(slackIdentities)
    .values({
      slackTeamId: input.slackTeamId,
      slackUserId: input.slackUserId,
      userId: input.userId,
      workspaceId: input.workspaceId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [slackIdentities.slackTeamId, slackIdentities.slackUserId],
      set: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        updatedAt: now,
      },
    });
}

export async function deleteSlackIdentityForUser(
  db: InvoiceyDb,
  input: { userId: string; slackTeamId: string; slackUserId: string },
): Promise<boolean> {
  const deleted = await db
    .delete(slackIdentities)
    .where(
      and(
        eq(slackIdentities.userId, input.userId),
        eq(slackIdentities.slackTeamId, input.slackTeamId),
        eq(slackIdentities.slackUserId, input.slackUserId),
      ),
    )
    .returning({ userId: slackIdentities.userId });
  return deleted.length > 0;
}

export async function rebindSlackIdentityWorkspace(
  db: InvoiceyDb,
  input: {
    userId: string;
    slackTeamId: string;
    slackUserId: string;
    workspaceId: string;
  },
  now = new Date(),
): Promise<boolean> {
  const updated = await db
    .update(slackIdentities)
    .set({ workspaceId: input.workspaceId, updatedAt: now })
    .where(
      and(
        eq(slackIdentities.userId, input.userId),
        eq(slackIdentities.slackTeamId, input.slackTeamId),
        eq(slackIdentities.slackUserId, input.slackUserId),
      ),
    )
    .returning({ userId: slackIdentities.userId });
  return updated.length > 0;
}
