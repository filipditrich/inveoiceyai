import type { ClientOption, IssuerOption } from "@/lib/invoice-party-types";
import { ensureAllIssuerNumberingSchemes } from "@/lib/issuer-numbering";
import {
  ClientSnapshotSchema,
  IssuerSnapshotSchema,
} from "@invoicey/invoice-core/schema";
import {
  clients,
  issuerBusinesses,
  issuerNumberingSchemes,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { eq } from "drizzle-orm";

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
  const rows = await db
    .select()
    .from(clients)
    .where(eq(clients.workspaceId, workspaceId));
  const out: ClientOption[] = [];
  const seenIcos = new Set<string>();
  for (const r of rows) {
    const snap = ClientSnapshotSchema.safeParse(r.snapshot);
    if (!snap.success) {
      continue;
    }
    const normalizedIco = snap.data.ico?.replaceAll(/\D/g, "");
    if (normalizedIco && seenIcos.has(normalizedIco)) {
      continue;
    }
    if (normalizedIco) {
      seenIcos.add(normalizedIco);
    }
    out.push({ id: r.id, snapshot: snap.data });
  }
  return out.toSorted((a, b) =>
    a.snapshot.name.localeCompare(b.snapshot.name, "cs"),
  );
}
