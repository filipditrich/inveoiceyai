import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { InvoiceyDb } from "./create-db";
import { resolveEntitlements } from "./entitlements";
import { plans } from "./plans";
import { clients, invoiceTemplates, invoices } from "./schema";
import { workspaces } from "./workspaces";

/**
 * Thrown when a workspace whose plan manages its clients tries to reach a
 * counterparty outside the catalog (ADR 0036).
 */
export class ManagedClientsError extends Error {
  readonly code = "clients_managed" as const;
  constructor(
    message = "Workspace can only use clients from its plan catalog",
  ) {
    super(message);
    this.name = "ManagedClientsError";
  }
}

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
  const n = name.normalize("NFKC").trim().replaceAll(/\s+/g, " ").toLowerCase();
  return n.length > 0 ? n : undefined;
}

function normalizeIdentityPart(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replaceAll(/\s+/g, " ")
    .toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

/** Stable legal-name + full-address identity used when an IČO is unavailable. */
export function clientAddressIdentity(
  snapshot: Record<string, unknown>,
): string | undefined {
  const name = normalizeClientName(snapshot.name);
  const address =
    snapshot.address &&
    typeof snapshot.address === "object" &&
    !Array.isArray(snapshot.address)
      ? (snapshot.address as Record<string, unknown>)
      : null;
  const street = normalizeIdentityPart(address?.street);
  const city = normalizeIdentityPart(address?.city);
  const zip = normalizeIdentityPart(address?.zip)?.replaceAll(/\s/g, "");
  const country = normalizeIdentityPart(address?.country);
  if (!name || !street || !city || !zip || !country) {
    return undefined;
  }
  return [name, street, city, zip, country].join("|");
}

export type EnsureClientOptions = {
  /**
   * Skips the managed-client gate. Only the catalog sync itself sets this —
   * it is the one writer allowed to create a managed client.
   */
  skipManagedCheck?: boolean;
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

async function findClientIdByIdentity(
  database: InvoiceyDb,
  workspaceId: string,
  snapshot: Record<string, unknown>,
): Promise<string | null> {
  const identity = clientAddressIdentity(snapshot);
  if (!identity) {
    return null;
  }
  const [name, street, city, zip, country] = identity.split("|") as [
    string,
    string,
    string,
    string,
    string,
  ];
  const rows = await database
    .select({ id: clients.id, snapshot: clients.snapshot })
    .from(clients)
    .where(
      and(
        eq(clients.workspaceId, workspaceId),
        sql`lower(regexp_replace(btrim(coalesce(${clients.snapshot}->>'name', '')), '\\s+', ' ', 'g')) = ${name}`,
        sql`lower(regexp_replace(btrim(coalesce(${clients.snapshot}->'address'->>'street', '')), '\\s+', ' ', 'g')) = ${street}`,
        sql`lower(regexp_replace(btrim(coalesce(${clients.snapshot}->'address'->>'city', '')), '\\s+', ' ', 'g')) = ${city}`,
        sql`lower(regexp_replace(btrim(coalesce(${clients.snapshot}->'address'->>'zip', '')), '\\s+', '', 'g')) = ${zip}`,
        sql`lower(btrim(coalesce(${clients.snapshot}->'address'->>'country', ''))) = ${country}`,
      ),
    )
    .limit(20);

  const incomingIco = normalizeIco(snapshot.ico);
  if (incomingIco) {
    return (
      rows.find((row) => normalizeIco(row.snapshot.ico) === incomingIco)?.id ??
      rows.find((row) => !normalizeIco(row.snapshot.ico))?.id ??
      null
    );
  }

  const withoutIco = rows.find((row) => !normalizeIco(row.snapshot.ico));
  if (withoutIco) return withoutIco.id;
  const knownIcos = new Set(
    rows
      .map((row) => normalizeIco(row.snapshot.ico))
      .filter((ico): ico is string => Boolean(ico)),
  );
  return knownIcos.size === 1 ? (rows[0]?.id ?? null) : null;
}

/**
 * Resolve a workspace client by existing id, then IČO, then legal name + address.
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
  if (!existingId) {
    existingId = await findClientIdByIdentity(
      database,
      workspaceId,
      clientSnapshot,
    );
  }

  // Managed-client enforcement lives here rather than in each caller because
  // every write path — web form, importer, MCP, Eve/Slack, the AI draft —
  // funnels through this function. A per-call-site check would be a list to
  // keep in sync, and the first surface anyone forgot would silently reopen
  // the hole (ADR 0036).
  if (!options?.skipManagedCheck) {
    const managed = await workspaceClientsAreManaged(database, workspaceId);
    if (managed) {
      if (!existingId) {
        throw new ManagedClientsError();
      }
      const [row] = await database
        .select({ planClientId: clients.planClientId })
        .from(clients)
        .where(eq(clients.id, existingId))
        .limit(1);
      if (!row?.planClientId) {
        throw new ManagedClientsError();
      }
      // The catalog is authoritative for a managed client, so an incoming
      // snapshot must not overwrite it — return the row untouched.
      return existingId;
    }
  }

  if (existingId) {
    const [stored] = await database
      .select({ snapshot: clients.snapshot, source: clients.source })
      .from(clients)
      .where(
        and(eq(clients.id, existingId), eq(clients.workspaceId, workspaceId)),
      )
      .limit(1);
    const snapshot = {
      ...((stored?.snapshot as Record<string, unknown> | undefined) ?? {}),
      ...clientSnapshot,
      id: existingId,
      ...(ico !== undefined ? { ico } : {}),
    };
    await database
      .update(clients)
      .set({
        snapshot,
        source:
          normalizeIco(stored?.snapshot?.ico) && ico === undefined
            ? (stored?.source ?? source)
            : source,
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
  } catch (error) {
    /** Race on a database identity index — reuse the winning row. */
    const raced =
      (await findClientIdByIco(database, workspaceId, ico)) ??
      (await findClientIdByIdentity(database, workspaceId, clientSnapshot));
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
    throw error;
  }
}

export type ClientMergeRow = {
  id: string;
  createdAt: Date;
  snapshot: Record<string, unknown>;
};

/** Strongest available merge key for display and stable test assertions. */
export function clientMergeGroupKey(row: ClientMergeRow): string | null {
  const ico = normalizeIco(row.snapshot.ico);
  if (ico) {
    return `ico:${ico}`;
  }
  const identity = clientAddressIdentity(row.snapshot);
  if (identity) {
    return `identity:${identity}`;
  }
  const fallbackName = normalizeClientName(row.snapshot.name);
  if (fallbackName) {
    return `name:${fallbackName}`;
  }
  return null;
}

/** Prefer a row with IČO, then keep oldest created_at; stable by id on ties. */
export function pickMergeKeepId(rows: ClientMergeRow[]): string {
  const sorted = [...rows].sort((a, b) => {
    const icoRank =
      Number(Boolean(normalizeIco(b.snapshot.ico))) -
      Number(Boolean(normalizeIco(a.snapshot.ico)));
    if (icoRank !== 0) {
      return icoRank;
    }
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
  const parents = new Map(rows.map((row) => [row.id, row.id]));
  const ownerByKey = new Map<string, string>();
  const keysById = new Map<string, string[]>();
  const icosByIdentity = new Map<string, Set<string>>();

  for (const row of rows) {
    const identity = clientAddressIdentity(row.snapshot);
    const ico = normalizeIco(row.snapshot.ico);
    if (identity && ico) {
      const values = icosByIdentity.get(identity) ?? new Set<string>();
      values.add(ico);
      icosByIdentity.set(identity, values);
    }
  }

  const find = (id: string): string => {
    const parent = parents.get(id) ?? id;
    if (parent === id) return id;
    const root = find(parent);
    parents.set(id, root);
    return root;
  };
  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents.set(rightRoot, leftRoot);
  };

  for (const row of rows) {
    const keys: string[] = [];
    const ico = normalizeIco(row.snapshot.ico);
    const identity = clientAddressIdentity(row.snapshot);
    if (ico) keys.push(`ico:${ico}`);
    // Never merge two known, different legal entities merely because they
    // share the same name and postal address.
    if (identity && (icosByIdentity.get(identity)?.size ?? 0) <= 1) {
      keys.push(`identity:${identity}`);
    }
    if (keys.length === 0) {
      const name = normalizeClientName(row.snapshot.name);
      if (name) keys.push(`name:${name}`);
    }
    keysById.set(row.id, keys);
    for (const key of keys) {
      const owner = ownerByKey.get(key);
      if (owner) union(row.id, owner);
      else ownerByKey.set(key, row.id);
    }
  }

  const components = new Map<string, ClientMergeRow[]>();
  for (const row of rows) {
    if ((keysById.get(row.id)?.length ?? 0) === 0) continue;
    const root = find(row.id);
    const component = components.get(root) ?? [];
    component.push(row);
    components.set(root, component);
  }

  const groups = new Map<string, ClientMergeRow[]>();
  for (const component of components.values()) {
    const key = component
      .flatMap((row) => keysById.get(row.id) ?? [])
      .sort((a, b) => {
        const rank = (value: string) =>
          value.startsWith("ico:") ? 0 : value.startsWith("identity:") ? 1 : 2;
        return rank(a) - rank(b) || a.localeCompare(b);
      })[0];
    if (key) groups.set(key, component);
  }
  return groups;
}

export type MergeDuplicateClientsResult = {
  mergedGroups: number;
  clientsRemoved: number;
  invoicesRepointed: number;
  templatesRepointed: number;
};

/**
 * Collapse duplicate clients in a workspace by IČO and legal name + address.
 * Re-points invoices and recurring templates before deleting extras.
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
  let templatesRepointed = 0;

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

    const updatedTemplates = await database
      .update(invoiceTemplates)
      .set({ clientId: keepId, updatedAt: new Date() })
      .where(
        and(
          eq(invoiceTemplates.workspaceId, workspaceId),
          inArray(invoiceTemplates.clientId, dropIds),
        ),
      )
      .returning({ id: invoiceTemplates.id });
    templatesRepointed += updatedTemplates.length;

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

  return {
    mergedGroups,
    clientsRemoved,
    invoicesRepointed,
    templatesRepointed,
  };
}

/**
 * Reads the workspace's resolved `clients.createMode`. Kept local rather than
 * imported from `plans-repo` to avoid a module cycle: `plans-repo` already
 * reaches into this file's normalizers.
 */
async function workspaceClientsAreManaged(
  database: InvoiceyDb,
  workspaceId: string,
): Promise<boolean> {
  const [row] = await database
    .select({
      entitlements: plans.entitlements,
      overrides: workspaces.entitlementOverrides,
    })
    .from(workspaces)
    .innerJoin(plans, eq(plans.id, workspaces.planId))
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!row) return false;
  return (
    resolveEntitlements(row.entitlements, row.overrides).clients.createMode ===
    "managed"
  );
}
