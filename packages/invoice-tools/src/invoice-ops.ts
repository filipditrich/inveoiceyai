import {
  getDefaultWorkspaceId,
  invoiceItems,
  invoices,
  issuerBusinesses,
  issuerNumberingSchemes,
  tryCreateDbFromEnv,
  type InvoiceyDb,
} from "@invoicey/db";
import { withDbTransaction } from "@invoicey/db/transaction";
import { nextInvoiceNumber } from "@invoicey/invoice-core";
import {
  ClientSnapshotSchema,
  InvoiceSchema,
  IssuerSnapshotSchema,
  type Invoice,
  type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";
import { deriveStatus, type InvoiceStatus } from "@invoicey/invoice-core/status";
import {
  resolveDisplayStatus,
  type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDemoIssuer } from "./demo-issuer";
import { tryPersistInvoiceArtifacts } from "./invoice-artifacts";

export interface InvoiceSummary {
  id: string;
  number: string | null;
  docType: string;
  clientName: string;
  total: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  issuedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  status: InvoiceStatus;
  displayStatus: InvoiceDisplayStatus;
}

function pragueTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function requireDb(): InvoiceyDb {
  const database = tryCreateDbFromEnv();
  if (!database) {
    throw new Error("DATABASE_URL is not set");
  }
  return database;
}

function rowToSummary(row: typeof invoices.$inferSelect): InvoiceSummary {
  const now = new Date();
  const todayIso = pragueTodayIso();
  const status = deriveStatus(
    {
      issuedAt: row.issuedAt,
      dueDate: new Date(`${row.dueDate}T12:00:00.000Z`),
      paidAt: row.paidAt,
      cancelledAt: row.cancelledAt,
    },
    now,
  );
  const displayStatus = resolveDisplayStatus(
    {
      issuedAt: row.issuedAt,
      dueDate: row.dueDate,
      paidAt: row.paidAt,
      cancelledAt: row.cancelledAt,
      issueDate: row.issueDate,
    },
    todayIso,
  );
  return {
    id: row.id,
    number: row.number,
    docType: row.docType,
    clientName: row.clientName,
    total: String(row.total),
    currency: row.currency,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    status,
    displayStatus,
  };
}

/** Prefer first Neon issuer; else demo issuer. */
export async function resolveDefaultIssuer(options?: {
  workspaceId?: string;
}): Promise<IssuerSnapshot> {
  const database = tryCreateDbFromEnv();
  if (!database) {
    return getDemoIssuer();
  }
  const workspaceId = options?.workspaceId ?? getDefaultWorkspaceId();
  const rows = await database
    .select()
    .from(issuerBusinesses)
    .where(eq(issuerBusinesses.workspaceId, workspaceId))
    .orderBy(desc(issuerBusinesses.updatedAt))
    .limit(1);
  const snap = rows[0]
    ? IssuerSnapshotSchema.safeParse(rows[0].snapshot)
    : null;
  if (snap?.success) {
    return snap.data;
  }
  return getDemoIssuer();
}

export async function listInvoices(options?: {
  workspaceId?: string;
  limit?: number;
  unpaidOnly?: boolean;
}): Promise<InvoiceSummary[]> {
  const database = requireDb();
  const workspaceId = options?.workspaceId ?? getDefaultWorkspaceId();
  const limit = options?.limit ?? 25;

  const conditions = [eq(invoices.workspaceId, workspaceId)];
  if (options?.unpaidOnly) {
    conditions.push(sql`${invoices.issuedAt} is not null`);
    conditions.push(isNull(invoices.paidAt));
    conditions.push(isNull(invoices.cancelledAt));
  }

  const rows = await database
    .select()
    .from(invoices)
    .where(and(...conditions))
    .orderBy(desc(invoices.updatedAt))
    .limit(limit);

  return rows.map(rowToSummary);
}

export async function getInvoice(options: {
  id: string;
  workspaceId?: string;
}): Promise<
  | { ok: true; summary: InvoiceSummary; invoice: Invoice | null }
  | { ok: false; error: string }
> {
  const database = requireDb();
  const workspaceId = options.workspaceId ?? getDefaultWorkspaceId();
  const rows = await database
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.id, options.id), eq(invoices.workspaceId, workspaceId)),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { ok: false, error: `invoice not found: ${options.id}` };
  }
  const parsed = InvoiceSchema.safeParse(row.payloadJson);
  return {
    ok: true,
    summary: rowToSummary(row),
    invoice: parsed.success ? parsed.data : null,
  };
}

export async function markInvoicePaidById(options: {
  id: string;
  workspaceId?: string;
}): Promise<
  { ok: true; summary: InvoiceSummary } | { ok: false; error: string }
> {
  const database = requireDb();
  const workspaceId = options.workspaceId ?? getDefaultWorkspaceId();
  const rows = await database
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.id, options.id), eq(invoices.workspaceId, workspaceId)),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { ok: false, error: `invoice not found: ${options.id}` };
  }
  if (!row.issuedAt || row.cancelledAt) {
    return { ok: false, error: "cannot_mark_paid" };
  }
  if (row.paidAt) {
    return { ok: true, summary: rowToSummary(row) };
  }
  const now = new Date();
  await database
    .update(invoices)
    .set({ paidAt: now, updatedAt: now })
    .where(eq(invoices.id, options.id));
  return {
    ok: true,
    summary: rowToSummary({ ...row, paidAt: now, updatedAt: now }),
  };
}

export async function cancelInvoiceById(options: {
  id: string;
  workspaceId?: string;
}): Promise<
  { ok: true; summary: InvoiceSummary } | { ok: false; error: string }
> {
  const database = requireDb();
  const workspaceId = options.workspaceId ?? getDefaultWorkspaceId();
  const rows = await database
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.id, options.id), eq(invoices.workspaceId, workspaceId)),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { ok: false, error: `invoice not found: ${options.id}` };
  }
  if (!row.issuedAt || row.paidAt || row.cancelledAt) {
    return { ok: false, error: "cannot_cancel" };
  }
  const now = new Date();
  await database
    .update(invoices)
    .set({ cancelledAt: now, updatedAt: now })
    .where(eq(invoices.id, options.id));
  return {
    ok: true,
    summary: rowToSummary({ ...row, cancelledAt: now, updatedAt: now }),
  };
}

/** Clear `paidAt` (no grace window). */
export async function unmarkInvoicePaidById(options: {
  id: string;
  workspaceId?: string;
}): Promise<
  { ok: true; summary: InvoiceSummary } | { ok: false; error: string }
> {
  const database = requireDb();
  const workspaceId = options.workspaceId ?? getDefaultWorkspaceId();
  const rows = await database
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.id, options.id), eq(invoices.workspaceId, workspaceId)),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { ok: false, error: `invoice not found: ${options.id}` };
  }
  if (!row.paidAt || row.cancelledAt) {
    return { ok: false, error: "cannot_unmark_paid" };
  }
  const now = new Date();
  await database
    .update(invoices)
    .set({ paidAt: null, updatedAt: now })
    .where(eq(invoices.id, options.id));
  return {
    ok: true,
    summary: rowToSummary({ ...row, paidAt: null, updatedAt: now }),
  };
}

export type BulkOpResult = {
  ok: number;
  skipped: number;
  failed: number;
};

async function loadWorkspaceInvoicesByIds(
  database: InvoiceyDb,
  workspaceId: string,
  ids: string[],
): Promise<(typeof invoices.$inferSelect)[]> {
  if (ids.length === 0) {
    return [];
  }
  return database
    .select()
    .from(invoices)
    .where(and(eq(invoices.workspaceId, workspaceId), inArray(invoices.id, ids)));
}

export async function bulkMarkInvoicesPaid(options: {
  ids: string[];
  workspaceId?: string;
}): Promise<BulkOpResult> {
  const database = requireDb();
  const workspaceId = options.workspaceId ?? getDefaultWorkspaceId();
  const rows = await loadWorkspaceInvoicesByIds(
    database,
    workspaceId,
    options.ids,
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const now = new Date();
  for (const id of options.ids) {
    const row = byId.get(id);
    if (!row) {
      failed += 1;
      continue;
    }
    if (!row.issuedAt || row.cancelledAt) {
      skipped += 1;
      continue;
    }
    if (row.paidAt) {
      skipped += 1;
      continue;
    }
    await database
      .update(invoices)
      .set({ paidAt: now, updatedAt: now })
      .where(eq(invoices.id, id));
    ok += 1;
  }
  return { ok, skipped, failed };
}

export async function bulkUnmarkInvoicesPaid(options: {
  ids: string[];
  workspaceId?: string;
}): Promise<BulkOpResult> {
  const database = requireDb();
  const workspaceId = options.workspaceId ?? getDefaultWorkspaceId();
  const rows = await loadWorkspaceInvoicesByIds(
    database,
    workspaceId,
    options.ids,
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const now = new Date();
  for (const id of options.ids) {
    const row = byId.get(id);
    if (!row) {
      failed += 1;
      continue;
    }
    if (!row.paidAt || row.cancelledAt) {
      skipped += 1;
      continue;
    }
    await database
      .update(invoices)
      .set({ paidAt: null, updatedAt: now })
      .where(eq(invoices.id, id));
    ok += 1;
  }
  return { ok, skipped, failed };
}

export async function bulkCancelInvoices(options: {
  ids: string[];
  workspaceId?: string;
}): Promise<BulkOpResult> {
  const database = requireDb();
  const workspaceId = options.workspaceId ?? getDefaultWorkspaceId();
  const rows = await loadWorkspaceInvoicesByIds(
    database,
    workspaceId,
    options.ids,
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const now = new Date();
  for (const id of options.ids) {
    const row = byId.get(id);
    if (!row) {
      failed += 1;
      continue;
    }
    if (!row.issuedAt || row.paidAt || row.cancelledAt) {
      skipped += 1;
      continue;
    }
    await database
      .update(invoices)
      .set({ cancelledAt: now, updatedAt: now })
      .where(eq(invoices.id, id));
    ok += 1;
  }
  return { ok, skipped, failed };
}

export async function bulkDeleteDraftInvoices(options: {
  ids: string[];
  workspaceId?: string;
}): Promise<BulkOpResult> {
  const database = requireDb();
  const workspaceId = options.workspaceId ?? getDefaultWorkspaceId();
  const rows = await loadWorkspaceInvoicesByIds(
    database,
    workspaceId,
    options.ids,
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of options.ids) {
    const row = byId.get(id);
    if (!row) {
      failed += 1;
      continue;
    }
    if (row.issuedAt) {
      skipped += 1;
      continue;
    }
    await database.delete(invoices).where(eq(invoices.id, id));
    ok += 1;
  }
  return { ok, skipped, failed };
}

/**
 * Issue a draft by id: lock numbering scheme, assign number, freeze snapshots.
 * Idempotent if already issued.
 */
export async function issueInvoiceById(options: {
  id: string;
  workspaceId?: string;
}): Promise<
  | { ok: true; summary: InvoiceSummary; invoice: Invoice; alreadyIssued: boolean }
  | { ok: false; error: string }
> {
  const workspaceId = options.workspaceId ?? getDefaultWorkspaceId();

  try {
    const result = await withDbTransaction(async (tx) => {
      const rows = await tx
        .select()
        .from(invoices)
        .where(
          and(eq(invoices.id, options.id), eq(invoices.workspaceId, workspaceId)),
        )
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new Error("not_found");
      }
      if (row.issuedAt) {
        const parsedExisting = InvoiceSchema.safeParse(row.payloadJson);
        if (!parsedExisting.success) {
          throw new Error("invalid_payload");
        }
        return {
          summary: rowToSummary(row),
          invoice: parsedExisting.data,
          alreadyIssued: true as const,
        };
      }

      const issuerRows = await tx
        .select()
        .from(issuerBusinesses)
        .where(
          and(
            eq(issuerBusinesses.id, row.issuerId),
            eq(issuerBusinesses.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      const clientSnap = ClientSnapshotSchema.safeParse(row.clientSnapshot);
      const issuerSnap = issuerRows[0]
        ? IssuerSnapshotSchema.safeParse(issuerRows[0].snapshot)
        : IssuerSnapshotSchema.safeParse(row.issuerSnapshot);
      if (!issuerSnap.success || !clientSnap.success) {
        throw new Error("missing_parties");
      }

      const draftParsed = InvoiceSchema.safeParse(row.payloadJson);
      if (!draftParsed.success) {
        throw new Error("invalid_payload");
      }

      const docType = row.docType as Invoice["meta"]["docType"];
      const schemeRows = await tx
        .select()
        .from(issuerNumberingSchemes)
        .where(
          and(
            eq(issuerNumberingSchemes.issuerId, row.issuerId),
            eq(issuerNumberingSchemes.docType, docType),
          ),
        )
        .for("update")
        .limit(1);

      const scheme = schemeRows[0];
      if (!scheme) {
        throw new Error("missing_scheme");
      }

      const issueDateStr = draftParsed.data.meta.issueDate;
      const issueDate = new Date(`${issueDateStr}T12:00:00.000Z`);
      const number = nextInvoiceNumber(
        {
          template: scheme.template,
          counter: scheme.counter,
          counterYear: scheme.counterYear ?? undefined,
          resetPeriod: scheme.resetPeriod === "never" ? "never" : "yearly",
          padding: scheme.padding,
          docType,
          issuerName: issuerSnap.data.name,
        },
        issueDate,
      );

      const year = issueDate.getFullYear();
      let nextCounter = scheme.counter + 1;
      let nextYear = scheme.counterYear;
      if (scheme.resetPeriod === "yearly") {
        if (scheme.counterYear !== null && scheme.counterYear !== year) {
          nextCounter = 1;
        }
        nextYear = year;
      }

      const invoice: Invoice = {
        ...draftParsed.data,
        meta: {
          ...draftParsed.data.meta,
          number,
        },
        issuer: issuerSnap.data,
        client: clientSnap.data,
      };

      const parsed = InvoiceSchema.safeParse(invoice);
      if (!parsed.success) {
        throw new Error("validation");
      }

      const issuedAt = new Date();
      const now = new Date();
      await tx
        .update(invoices)
        .set({
          number,
          issuedAt,
          issuerSnapshot: parsed.data.issuer as unknown as Record<
            string,
            unknown
          >,
          clientSnapshot: parsed.data.client as unknown as Record<
            string,
            unknown
          >,
          payloadJson: parsed.data as unknown as Record<string, unknown>,
          total: String(parsed.data.totals.total),
          subtotal: String(parsed.data.totals.subtotal),
          vatTotal: String(parsed.data.totals.vatTotal),
          clientName: parsed.data.client.name,
          updatedAt: now,
        })
        .where(eq(invoices.id, options.id));

      await tx
        .delete(invoiceItems)
        .where(eq(invoiceItems.invoiceId, options.id));
      await tx.insert(invoiceItems).values(
        parsed.data.items.map((line) => ({
          id: crypto.randomUUID(),
          invoiceId: options.id,
          position: line.position,
          description: line.description,
          quantity: String(line.quantity),
          unit: line.unit,
          unitPriceWithoutVat: String(line.unitPriceWithoutVat),
          vatRate: String(line.vatRate),
          lineSubtotal: String(line.lineSubtotal),
          lineVat: String(line.lineVat),
          lineTotal: String(line.lineTotal),
        })),
      );

      await tx
        .update(issuerNumberingSchemes)
        .set({
          counter: nextCounter,
          counterYear: nextYear,
          updatedAt: now,
        })
        .where(eq(issuerNumberingSchemes.id, scheme.id));

      return {
        summary: rowToSummary({
          ...row,
          number,
          issuedAt,
          payloadJson: parsed.data as unknown as Record<string, unknown>,
          total: String(parsed.data.totals.total),
          subtotal: String(parsed.data.totals.subtotal),
          vatTotal: String(parsed.data.totals.vatTotal),
          clientName: parsed.data.client.name,
          updatedAt: now,
        }),
        invoice: parsed.data,
        alreadyIssued: false as const,
      };
    });

    await tryPersistInvoiceArtifacts({
      id: options.id,
      workspaceId,
      invoice: result.invoice,
    });

    return { ok: true, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "not_found") {
      return { ok: false, error: `invoice not found: ${options.id}` };
    }
    return { ok: false, error: message };
  }
}

export async function bulkIssueInvoices(options: {
  ids: string[];
  workspaceId?: string;
}): Promise<BulkOpResult> {
  const workspaceId = options.workspaceId ?? getDefaultWorkspaceId();
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of options.ids) {
    const result = await issueInvoiceById({ id, workspaceId });
    if (!result.ok) {
      if (result.error.startsWith("invoice not found")) {
        failed += 1;
      } else {
        skipped += 1;
      }
      continue;
    }
    if (result.alreadyIssued) {
      skipped += 1;
      continue;
    }
    ok += 1;
  }
  return { ok, skipped, failed };
}
