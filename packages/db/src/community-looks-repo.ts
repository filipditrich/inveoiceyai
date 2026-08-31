import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { InvoiceyDb } from "./create-db";
import { communityLooks } from "./schema";
import type { DbTransaction } from "./transaction";

type Db = InvoiceyDb | DbTransaction;

export type CommunityLookRow = {
  id: string;
  lookId: string;
  version: string;
  document: Record<string, unknown>;
  publisherWorkspaceId: string;
  unpublishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listPublishedCommunityLookRows(
  db: Db,
): Promise<CommunityLookRow[]> {
  return db
    .select()
    .from(communityLooks)
    .where(isNull(communityLooks.unpublishedAt));
}

export async function getCommunityLookRow(
  db: Db,
  lookId: string,
  version: string,
): Promise<CommunityLookRow | undefined> {
  const [row] = await db
    .select()
    .from(communityLooks)
    .where(
      and(
        eq(communityLooks.lookId, lookId),
        eq(communityLooks.version, version),
      ),
    )
    .limit(1);
  return row;
}

export async function getCommunityLookOwnership(
  db: Db,
  lookId: string,
): Promise<{ publisherWorkspaceId: string } | undefined> {
  const [row] = await db
    .select({
      publisherWorkspaceId: communityLooks.publisherWorkspaceId,
    })
    .from(communityLooks)
    .where(eq(communityLooks.lookId, lookId))
    .limit(1);
  return row;
}

export async function listPublishedCommunityLookRowsForPublisher(
  db: Db,
  publisherWorkspaceId: string,
): Promise<CommunityLookRow[]> {
  return db
    .select()
    .from(communityLooks)
    .where(
      and(
        eq(communityLooks.publisherWorkspaceId, publisherWorkspaceId),
        isNull(communityLooks.unpublishedAt),
      ),
    );
}

export async function listCommunityLookRowsForPublisher(
  db: Db,
  publisherWorkspaceId: string,
  lookId: string,
): Promise<CommunityLookRow[]> {
  return db
    .select()
    .from(communityLooks)
    .where(
      and(
        eq(communityLooks.publisherWorkspaceId, publisherWorkspaceId),
        eq(communityLooks.lookId, lookId),
      ),
    );
}

export async function upsertPublishedCommunityLookRow(
  db: Db,
  input: {
    lookId: string;
    version: string;
    document: Record<string, unknown>;
    publisherWorkspaceId: string;
  },
): Promise<CommunityLookRow> {
  const existing = await getCommunityLookRow(db, input.lookId, input.version);
  const now = new Date();
  if (existing) {
    const [row] = await db
      .update(communityLooks)
      .set({
        document: input.document,
        unpublishedAt: null,
        updatedAt: now,
      })
      .where(eq(communityLooks.id, existing.id))
      .returning();
    return row!;
  }
  const row: CommunityLookRow = {
    id: randomUUID(),
    lookId: input.lookId,
    version: input.version,
    document: input.document,
    publisherWorkspaceId: input.publisherWorkspaceId,
    unpublishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(communityLooks).values(row);
  return row;
}

export async function unpublishCommunityLookRows(
  db: Db,
  publisherWorkspaceId: string,
  lookId: string,
): Promise<number> {
  const now = new Date();
  const updated = await db
    .update(communityLooks)
    .set({ unpublishedAt: now, updatedAt: now })
    .where(
      and(
        eq(communityLooks.publisherWorkspaceId, publisherWorkspaceId),
        eq(communityLooks.lookId, lookId),
        isNull(communityLooks.unpublishedAt),
      ),
    )
    .returning();
  return updated.length;
}
