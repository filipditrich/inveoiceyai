import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { InvoiceyDb } from "./create-db";
import { workspaceLooks } from "./schema";
import type { DbTransaction } from "./transaction";

type Db = InvoiceyDb | DbTransaction;

export type WorkspaceLookRow = {
  id: string;
  workspaceId: string;
  lookId: string;
  version: string;
  document: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export async function listWorkspaceLookRows(
  db: Db,
  workspaceId: string,
): Promise<WorkspaceLookRow[]> {
  return db
    .select()
    .from(workspaceLooks)
    .where(eq(workspaceLooks.workspaceId, workspaceId));
}

export async function getWorkspaceLookRow(
  db: Db,
  workspaceId: string,
  lookId: string,
  version: string,
): Promise<WorkspaceLookRow | undefined> {
  const [row] = await db
    .select()
    .from(workspaceLooks)
    .where(
      and(
        eq(workspaceLooks.workspaceId, workspaceId),
        eq(workspaceLooks.lookId, lookId),
        eq(workspaceLooks.version, version),
      ),
    )
    .limit(1);
  return row;
}

export async function insertWorkspaceLookRow(
  db: Db,
  input: {
    workspaceId: string;
    lookId: string;
    version: string;
    document: Record<string, unknown>;
  },
): Promise<WorkspaceLookRow> {
  const now = new Date();
  const row: WorkspaceLookRow = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    lookId: input.lookId,
    version: input.version,
    document: input.document,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(workspaceLooks).values(row);
  return row;
}

export async function deleteWorkspaceLookRows(
  db: Db,
  workspaceId: string,
  lookId: string,
): Promise<number> {
  const removed = await db
    .delete(workspaceLooks)
    .where(
      and(
        eq(workspaceLooks.workspaceId, workspaceId),
        eq(workspaceLooks.lookId, lookId),
      ),
    )
    .returning();
  return removed.length;
}
