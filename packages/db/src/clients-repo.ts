import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { InvoiceyDb } from "./create-db";
import { clients, invoices } from "./schema";

/** Digits-only IČO for matching (empty → undefined). */
export function normalizeIco(ico: unknown): string | undefined {
  if (typeof ico !== "string") {
    return undefined;
  }
  const digits = ico.replaceAll(/\D/g, "");
  return digits.length > 0 ? digits : undefined;
}

/** Casefolded trimmed name for matching (empty → undefined). */
export function normalizeClientName(name: unknown): string | undefined {
  if (typeof name !== "string") {
    return undefined;
  }
  const n = name.trim().toLowerCase();
  return n.length > 0 ? n : undefined;
}

export type EnsureClientOptions = {
  preferredId?: string;
  /** Defaults to `ares` when IČO present, else `manual`. */
  source?: string;
};

async function findClientIdByIco(
  database: InvoiceyDb,
  workspaceId: string,
  ico: string | undefined,
): Promise<string | null> {
  const icoNorm = normalizeIco(ico);
  if (!icoNorm) {
    return null;
  }
  const rows = await database
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.workspaceId, workspaceId),
        sql`regexp_replace(coalesce(${clients.snapshot}->>'ico', ''), '\\D', '', 'g') = ${icoNorm}`,
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

async function findClientIdByName(
  database: InvoiceyDb,
  workspaceId: string,
  name: string | undefined,
): Promise<string | null> {
  const nameNorm = normalizeClientName(name);
  if (!nameNorm) {
    return null;
  }
  const rows = await database
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.workspaceId, workspaceId),
        sql`lower(trim(coalesce(${clients.snapshot}->>'name', ''))) = ${nameNorm}`,
        sql`(
          ${clients.snapshot}->>'ico' IS NULL
          OR btrim(${clients.snapshot}->>'ico') = ''
        )`,
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Resolve a workspace client by existing id, then IČO, then name (no IČO).
 * Parse-time UUIDs that are not in the DB are not treated as identity.
 */
export async function ensureClient(
  database: InvoiceyDb,
  workspaceId: string,
  clientSnapshot: Record<string, unknown>,
  options?: EnsureClientOptions,
): Promise<string> {
  const preferredId = options?.preferredId;
  const ico = normalizeIco(clientSnapshot.ico);
  const name =
    typeof clientSnapshot.name === "string" ? clientSnapshot.name : undefined;
  const now = new Date();
  const source = options?.source ?? (ico !== undefined ? "ares" : "manual");

  let existingId: string | null = null;
  if (preferredId) {
    const found = await database
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(eq(clients.id, preferredId), eq(clients.workspaceId, workspaceId)),
      )
      .limit(1);
    if (found[0]) {
      existingId = found[0].id;
    }
  }
  if (!existingId) {
    existingId = await findClientIdByIco(database, workspaceId, ico);
  }
  if (!existingId && !ico) {
    existingId = await findClientIdByName(database, workspaceId, name);
  }

  if (existingId) {
    const snapshot = {
      ...clientSnapshot,
      id: existingId,
      ...(ico !== undefined ? { ico } : {}),
    };
    await database
      .update(clients)
      .set({
        snapshot,
        source,
        updatedAt: now,
      })
      .where(eq(clients.id, existingId));
    return existingId;
  }

  const id = preferredId ?? randomUUID();
  const snapshot = {
    ...clientSnapshot,
    id,
    ...(ico !== undefined ? { ico } : {}),
  };
  try {
    await database.insert(clients).values({
      id,
      workspaceId,
      source,
      snapshot,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  } catch {
    /** race on unique (workspace, ico) — reuse winner */
    const raced = await findClientIdByIco(database, workspaceId, ico);
    if (raced) {
      await database
        .update(clients)
        .set({
          snapshot: { ...snapshot, id: raced },
          source,
          updatedAt: now,
        })
        .where(eq(clients.id, raced));
      return raced;
    }
    throw new Error("client_insert_failed");
  }
}

export type ClientMergeRow = {
  id: string;
  createdAt: Date;
  snapshot: Record<string, unknown>;
};

/** Group key: `ico:<digits>` or `name:<normalized>` for IČO-less rows. */
export function clientMergeGroupKey(row: ClientMergeRow): string | null {
  const ico = normalizeIco(row.snapshot.ico);
  if (ico) {
    return `ico:${ico}`;
  }
  const name = normalizeClientName(row.snapshot.name);
  if (name) {
    return `name:${name}`;
  }
  return null;
}

/** Keep oldest created_at; stable by id on ties. */
export function pickMergeKeepId(rows: ClientMergeRow[]): string {
  const sorted = [...rows].sort((a, b) => {
    const t = a.createdAt.getTime() - b.createdAt.getTime();
    if (t !== 0) {
      return t;
    }
    return a.id.localeCompare(b.id);
  });
  return sorted[0]!.id;
}

export function groupClientsForMerge(
  rows: ClientMergeRow[],
): Map<string, ClientMergeRow[]> {
  const groups = new Map<string, ClientMergeRow[]>();
  for (const row of rows) {
    const key = clientMergeGroupKey(row);
    if (!key) {
      continue;
    }
    const list = groups.get(key);
    if (list) {
      list.push(row);
    } else {
      groups.set(key, [row]);
    }
  }
  return groups;
}

export type MergeDuplicateClientsResult = {
  mergedGroups: number;
  clientsRemoved: number;
  invoicesRepointed: number;
};

/**
 * Collapse duplicate clients in a workspace (by IČO, else by name when IČO absent).
 * Re-points invoices to the kept row, then deletes extras.
 */
export async function mergeDuplicateClients(
  database: InvoiceyDb,
  workspaceId: string,
): Promise<MergeDuplicateClientsResult> {
  const rows = await database
    .select({
      id: clients.id,
      createdAt: clients.createdAt,
      snapshot: clients.snapshot,
    })
    .from(clients)
    .where(eq(clients.workspaceId, workspaceId));

  const groups = groupClientsForMerge(
    rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      snapshot: r.snapshot as Record<string, unknown>,
    })),
  );

  let mergedGroups = 0;
  let clientsRemoved = 0;
  let invoicesRepointed = 0;

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }
    mergedGroups += 1;
    const keepId = pickMergeKeepId(group);
    const dropIds = group.filter((r) => r.id !== keepId).map((r) => r.id);
    if (dropIds.length === 0) {
      continue;
    }

    const updated = await database
      .update(invoices)
      .set({ clientId: keepId, updatedAt: new Date() })
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          inArray(invoices.clientId, dropIds),
        ),
      )
      .returning({ id: invoices.id });
    invoicesRepointed += updated.length;

    const keep = group.find((r) => r.id === keepId)!;
    const richest = group.reduce((best, cur) => {
      const bestIco = normalizeIco(best.snapshot.ico);
      const curIco = normalizeIco(cur.snapshot.ico);
      if (!bestIco && curIco) {
        return cur;
      }
      return best;
    }, keep);
    await database
      .update(clients)
      .set({
        snapshot: { ...richest.snapshot, id: keepId },
        updatedAt: new Date(),
      })
      .where(eq(clients.id, keepId));

    await database
      .delete(clients)
      .where(
        and(eq(clients.workspaceId, workspaceId), inArray(clients.id, dropIds)),
      );
    clientsRemoved += dropIds.length;
  }

  return { mergedGroups, clientsRemoved, invoicesRepointed };
}
