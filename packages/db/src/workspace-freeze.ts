import { eq } from "drizzle-orm";

import type { InvoiceyDb } from "./create-db";
import type { DbTransaction } from "./transaction";
import { workspaces } from "./workspaces";

type DbOrTx = InvoiceyDb | DbTransaction;

/** Occupancy hold — not an entitlement (ADR 0046). */
export class WorkspaceFrozenError extends Error {
  readonly code = "workspace_frozen" as const;
  readonly workspaceId: string;

  constructor(workspaceId: string) {
    super(`Workspace ${workspaceId} is frozen`);
    this.name = "WorkspaceFrozenError";
    this.workspaceId = workspaceId;
  }
}

export function isFrozen(frozenAt: Date | null | undefined): boolean {
  return frozenAt != null;
}

export function assertNotFrozen(
  frozenAt: Date | null | undefined,
  workspaceId: string,
): void {
  if (isFrozen(frozenAt)) {
    throw new WorkspaceFrozenError(workspaceId);
  }
}

export type WorkspaceFreezeState = {
  frozenAt: Date | null;
  frozenBy: string | null;
  freezeReason: string | null;
};

export async function getWorkspaceFreeze(
  db: DbOrTx,
  workspaceId: string,
): Promise<WorkspaceFreezeState | null> {
  const [row] = await db
    .select({
      frozenAt: workspaces.frozenAt,
      frozenBy: workspaces.frozenBy,
      freezeReason: workspaces.freezeReason,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return row ?? null;
}

/**
 * Tenant writes fail closed. Missing workspace is treated as frozen so a
 * deleted or unknown id cannot slip through.
 */
export async function assertWorkspaceWritable(
  db: DbOrTx,
  workspaceId: string,
): Promise<void> {
  const row = await getWorkspaceFreeze(db, workspaceId);
  if (row == null) {
    throw new WorkspaceFrozenError(workspaceId);
  }
  assertNotFrozen(row.frozenAt, workspaceId);
}
