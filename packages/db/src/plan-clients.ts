import { and, eq, isNotNull, notInArray, sql } from "drizzle-orm";

import { normalizeIco } from "./clients-repo";
import type { InvoiceyDb } from "./create-db";
import { planClients, clients } from "./schema";
import type { DbTransaction } from "./transaction";
import { workspaces } from "./workspaces";

type DbOrTx = InvoiceyDb | DbTransaction;

export interface PlanClientInput {
  planId: string;
  ico: string;
  snapshot: Record<string, unknown>;
}

export interface PlanClientRow {
  id: string;
  planId: string;
  ico: string;
  snapshot: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export async function listPlanClients(
  db: DbOrTx,
  planId: string,
): Promise<PlanClientRow[]> {
  return db
    .select()
    .from(planClients)
    .where(eq(planClients.planId, planId))
    .orderBy(planClients.ico);
}

/**
 * Adds or updates one catalog entry, then pushes it to every workspace on the
 * plan. Returns how many workspaces the change reached, which is the number the
 * admin needs to see before believing the edit did anything.
 */
export async function upsertPlanClient(
  db: InvoiceyDb,
  input: PlanClientInput,
): Promise<{ id: string; syncedWorkspaces: number }> {
  const ico = normalizeIco(input.ico);
  if (!ico) {
    throw new Error("plan client requires a normalizable IČO");
  }

  const [row] = await db
    .insert(planClients)
    .values({
      id: crypto.randomUUID(),
      planId: input.planId,
      ico,
      snapshot: { ...input.snapshot, ico },
    })
    .onConflictDoUpdate({
      target: [planClients.planId, planClients.ico],
      set: { snapshot: { ...input.snapshot, ico }, updatedAt: new Date() },
    })
    .returning({ id: planClients.id });

  const syncedWorkspaces = await syncPlanClients(db, input.planId);
  return { id: row!.id, syncedWorkspaces };
}

/**
 * Removes a catalog entry.
 *
 * The synced copies are **not** deleted — they are unmarked. Historical
 * invoices list clients by name, and snapshots freeze at issue time (ADR 0008),
 * so deleting a counterparty a workspace has already billed would damage the
 * past to enforce a rule about the future. Unmarking is enough: under
 * `createMode: "managed"` the picker only offers marked rows, so the client
 * stops being billable without disappearing.
 */
export async function removePlanClient(
  db: InvoiceyDb,
  planClientId: string,
): Promise<void> {
  await db
    .update(clients)
    .set({ planClientId: null, updatedAt: new Date() })
    .where(eq(clients.planClientId, planClientId));

  await db.delete(planClients).where(eq(planClients.id, planClientId));
}

/**
 * Materializes a plan's catalog into every workspace on that plan (ADR 0036).
 *
 * Catalog entries sync *into* workspaces rather than being read across them:
 * the reason contractors get separate workspaces at all is that none of them
 * may see another's data, and a cross-tenant read would need a tenancy
 * exception in every client query to work. Duplicated rows are the cheaper
 * trade — a handful per workspace, and snapshots, dedup, and invoice rendering
 * all stay exactly as they were.
 *
 * Matching is by normalized IČO, reusing the identity the existing unique index
 * already enforces, so a workspace that had already created the counterparty by
 * hand gets that row adopted rather than a duplicate.
 */
export async function syncPlanClients(
  db: InvoiceyDb,
  planId: string,
): Promise<number> {
  const [catalog, targets] = await Promise.all([
    listPlanClients(db, planId),
    db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.planId, planId)),
  ]);

  if (targets.length === 0) return 0;

  for (const workspace of targets) {
    await syncPlanClientsIntoWorkspace(db, workspace.id, catalog);
  }
  return targets.length;
}

/**
 * One workspace's half of the sync. Also runs on plan assignment, so a
 * workspace moved onto a managed plan has its catalog immediately.
 */
export async function syncPlanClientsIntoWorkspace(
  db: InvoiceyDb,
  workspaceId: string,
  catalog: PlanClientRow[],
): Promise<void> {
  const keep = new Set<string>();

  for (const entry of catalog) {
    const existing = await db
      .select({ id: clients.id, snapshot: clients.snapshot })
      .from(clients)
      .where(
        and(
          eq(clients.workspaceId, workspaceId),
          sql`regexp_replace(coalesce(${clients.snapshot}->>'ico', ''), '\\D', '', 'g') = ${entry.ico}`,
        ),
      )
      .limit(1);

    if (existing[0]) {
      keep.add(existing[0].id);
      await db
        .update(clients)
        .set({
          // The catalog is authoritative for a managed client, but the row's
          // own id must survive — invoices and drafts reference it.
          snapshot: { ...entry.snapshot, id: existing[0].id },
          planClientId: entry.id,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, existing[0].id));
      continue;
    }

    const id = crypto.randomUUID();
    keep.add(id);
    await db.insert(clients).values({
      id,
      workspaceId,
      source: "ares",
      snapshot: { ...entry.snapshot, id },
      planClientId: entry.id,
    });
  }

  // Anything still flagged as managed but no longer in the catalog becomes an
  // ordinary client again. Never deleted — see `removePlanClient`.
  const stillManaged = and(
    eq(clients.workspaceId, workspaceId),
    isNotNull(clients.planClientId),
  );
  await db
    .update(clients)
    .set({ planClientId: null, updatedAt: new Date() })
    .where(
      keep.size === 0
        ? stillManaged
        : and(stillManaged, notInArray(clients.id, [...keep])),
    );
}

/** Clears managed marks when a workspace leaves a managed plan. */
export async function unmarkManagedClients(
  db: DbOrTx,
  workspaceId: string,
): Promise<void> {
  await db
    .update(clients)
    .set({ planClientId: null, updatedAt: new Date() })
    .where(
      and(
        eq(clients.workspaceId, workspaceId),
        isNotNull(clients.planClientId),
      ),
    );
}
