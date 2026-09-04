import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";

import {
  bankConnections,
  communityLooks,
  emailSuppressions,
  notUnclaimedWorkspaces,
  workspaces,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

export type AdminBankConnectionRow = {
  id: string;
  provider: string;
  status: string;
  lastSyncErrorCode: string | null;
  lastSyncSucceededAt: Date | null;
  consecutiveFailureCount: number;
  createdAt: Date;
};

export type AdminSuppressionRow = {
  id: string;
  email: string;
  reason: string;
  createdAt: Date;
};

export type AdminCommunityLookRow = {
  lookId: string;
  version: string;
  publisherWorkspaceId: string;
  publisherWorkspaceName: string;
  createdAt: Date;
};

export async function adminListWorkspaceBanks(
  workspaceId: string,
): Promise<AdminBankConnectionRow[]> {
  return db
    .select({
      id: bankConnections.id,
      provider: bankConnections.provider,
      status: bankConnections.status,
      lastSyncErrorCode: bankConnections.lastSyncErrorCode,
      lastSyncSucceededAt: bankConnections.lastSyncSucceededAt,
      consecutiveFailureCount: bankConnections.consecutiveFailureCount,
      createdAt: bankConnections.createdAt,
    })
    .from(bankConnections)
    .where(eq(bankConnections.workspaceId, workspaceId))
    .orderBy(desc(bankConnections.createdAt));
}

export async function adminListWorkspaceSuppressions(
  workspaceId: string,
): Promise<AdminSuppressionRow[]> {
  return db
    .select({
      id: emailSuppressions.id,
      email: emailSuppressions.email,
      reason: emailSuppressions.reason,
      createdAt: emailSuppressions.createdAt,
    })
    .from(emailSuppressions)
    .where(eq(emailSuppressions.workspaceId, workspaceId))
    .orderBy(desc(emailSuppressions.createdAt));
}

export async function adminListWorkspaceCommunityLooks(
  workspaceId: string,
): Promise<AdminCommunityLookRow[]> {
  const rows = await db
    .select({
      lookId: communityLooks.lookId,
      version: communityLooks.version,
      publisherWorkspaceId: communityLooks.publisherWorkspaceId,
      publisherWorkspaceName: workspaces.name,
      createdAt: communityLooks.createdAt,
    })
    .from(communityLooks)
    .innerJoin(
      workspaces,
      eq(communityLooks.publisherWorkspaceId, workspaces.id),
    )
    .where(
      and(
        eq(communityLooks.publisherWorkspaceId, workspaceId),
        isNull(communityLooks.unpublishedAt),
      ),
    )
    .orderBy(desc(communityLooks.createdAt));
  return rows;
}

export async function adminListLiveCommunityLooks(): Promise<
  AdminCommunityLookRow[]
> {
  return db
    .select({
      lookId: communityLooks.lookId,
      version: communityLooks.version,
      publisherWorkspaceId: communityLooks.publisherWorkspaceId,
      publisherWorkspaceName: workspaces.name,
      createdAt: communityLooks.createdAt,
    })
    .from(communityLooks)
    .innerJoin(
      workspaces,
      eq(communityLooks.publisherWorkspaceId, workspaces.id),
    )
    .where(and(isNull(communityLooks.unpublishedAt), notUnclaimedWorkspaces()))
    .orderBy(desc(communityLooks.createdAt));
}

export async function adminListInvoiceSuppressions(input: {
  workspaceId: string;
  emails: string[];
}): Promise<AdminSuppressionRow[]> {
  const emails = [
    ...new Set(
      input.emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
    ),
  ];
  if (emails.length === 0) return [];
  const rows = await adminListWorkspaceSuppressions(input.workspaceId);
  const wanted = new Set(emails);
  return rows.filter((row) => wanted.has(row.email.toLowerCase()));
}
