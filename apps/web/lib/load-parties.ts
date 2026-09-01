import { clientsAreManaged } from "@/lib/entitlements/managed-clients";
import { ensureAllIssuerNumberingSchemes } from "@/lib/issuer-numbering";
import { and, eq, isNotNull } from "drizzle-orm";

import {
  groupClientsForMerge,
  pickMergeKeepId,
  clients,
  issuerBusinesses,
  issuerNumberingSchemes,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  ClientSnapshotSchema,
  IssuerSnapshotSchema,
} from "@invoicey/invoice-core/schema";

import type { ClientOption, IssuerOption } from "@/lib/invoice-party-types";

export async function loadIssuerOptions(
  workspaceId: string,
): Promise<IssuerOption[]> {
  const rows = await db
    .select()
    .from(issuerBusinesses)
    .where(eq(issuerBusinesses.workspaceId, workspaceId));

  /** backfill defaults for issuers created before schemes were persisted */
  await ensureAllIssuerNumberingSchemes(
    workspaceId,
    rows.map((r) => r.id),
  );

  const schemes = await db
    .select()
    .from(issuerNumberingSchemes)
    .where(eq(issuerNumberingSchemes.workspaceId, workspaceId));

  const byIssuer = new Map<string, typeof schemes>();
  for (const s of schemes) {
    const list = byIssuer.get(s.issuerId) ?? [];
    list.push(s);
    byIssuer.set(s.issuerId, list);
  }

  const out: IssuerOption[] = [];
  for (const r of rows) {
    const snap = IssuerSnapshotSchema.safeParse(r.snapshot);
    if (!snap.success) {
      continue;
    }
    out.push({
      id: r.id,
      snapshot: snap.data,
      schemes: (byIssuer.get(r.id) ?? []).map((s) => ({
        docType: s.docType,
        template: s.template,
        counter: s.counter,
        counterYear: s.counterYear,
        resetPeriod: s.resetPeriod,
        padding: s.padding,
      })),
    });
  }
  return out;
}

export async function loadClientOptions(
  workspaceId: string,
): Promise<ClientOption[]> {
  // On a managed workspace the picker offers only the plan catalog (ADR 0036).
  // Filtering here rather than in each page keeps every invoice surface — new,
  // edit, duplicate, recurring — consistent by construction.
  const managed = await clientsAreManaged(workspaceId);
  const rows = await db
    .select()
    .from(clients)
    .where(
      managed
        ? and(
            eq(clients.workspaceId, workspaceId),
            isNotNull(clients.planClientId),
          )
        : eq(clients.workspaceId, workspaceId),
    );
  const duplicateIds = new Set<string>();
  for (const group of groupClientsForMerge(
    rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      snapshot: row.snapshot,
    })),
  ).values()) {
    if (group.length < 2) continue;
    const keepId = pickMergeKeepId(group);
    for (const row of group) {
      if (row.id !== keepId) duplicateIds.add(row.id);
    }
  }

  const out: ClientOption[] = [];
  for (const r of rows) {
    if (duplicateIds.has(r.id)) continue;
    const snap = ClientSnapshotSchema.safeParse(r.snapshot);
    if (!snap.success) {
      continue;
    }
    out.push({ id: r.id, snapshot: snap.data });
  }
  return out.toSorted((a, b) =>
    a.snapshot.name.localeCompare(b.snapshot.name, "cs"),
  );
}
