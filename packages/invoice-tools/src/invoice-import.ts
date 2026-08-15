import {
  ensureClient,
  invoiceImportBatches,
  invoiceItems,
  invoicePaymentAllocations,
  invoices,
  issuerBusinesses,
  issuerNumberingSchemes,
  type InvoiceyDb,
} from "@invoicey/db";
import {
  ArchiveInvoicePayloadSchema,
  InvoiceSchema,
  buildExternalKey,
  type ArchiveInvoicePayload,
  type Invoice,
  type InvoiceOrigin,
  type IssuerSnapshot,
} from "@invoicey/invoice-core";
import { and, eq, isNotNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

type InsertIssuedImportBase = {
  workspaceId: string;
  issuerId: string;
  issuerSnapshot: IssuerSnapshot;
  origin: InvoiceOrigin;
  importBatchId: string;
  externalKey: string;
  pdfUrl: string;
  isdocUrl?: string | null;
  paidAt?: Date | null;
  clientId?: string;
};

export type InsertIssuedImportInput =
  | (InsertIssuedImportBase & {
      completeness: "full";
      invoice: Invoice;
    })
  | (InsertIssuedImportBase & {
      completeness: "archive";
      archive: ArchiveInvoicePayload;
    });

export type InsertIssuedImportResult =
  | { ok: true; invoiceId: string; created: true }
  | {
      ok: true;
      invoiceId: string;
      created: false;
      reason: "duplicate_number" | "duplicate_external_key";
    }
  | { ok: false; error: string };

function issuedAtFromDate(issueDate: string): Date {
  return new Date(`${issueDate}T12:00:00.000Z`);
}

function extractCounterHint(number: string, issueDate: string): number | null {
  const year = issueDate.slice(0, 4);
  const digits = number.replaceAll(/\D/g, "");
  if (!digits) {
    return null;
  }
  if (digits.startsWith(year) && digits.length > year.length) {
    const rest = digits.slice(year.length);
    const n = Number(rest);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(digits.slice(-6));
  return Number.isFinite(n) ? n : null;
}

function archiveClientSnapshot(
  archive: ArchiveInvoicePayload,
  clientId: string,
): Record<string, unknown> {
  return {
    id: clientId,
    name: archive.client.name,
    ico: archive.client.ico,
    dic: archive.client.dic,
    address: archive.client.address ?? {
      street: "—",
      city: "—",
      zip: "000 00",
      country: "CZ",
    },
    contactEmail: archive.client.contactEmail,
  };
}

function archiveSyntheticItems(
  archive: ArchiveInvoicePayload,
): Invoice["items"] {
  return [
    {
      position: 1,
      description: "Archivní import — viz originální PDF",
      quantity: 1,
      unit: "ks",
      unitPriceWithoutVat: Math.max(0, archive.totals.subtotal),
      vatRate:
        archive.totals.subtotal > 0
          ? Math.round(
              (archive.totals.vatTotal / archive.totals.subtotal) * 100,
            )
          : 0,
      lineSubtotal: archive.totals.subtotal,
      lineVat: archive.totals.vatTotal,
      lineTotal: archive.totals.total,
    },
  ];
}

async function replaceItems(
  database: InvoiceyDb,
  invoiceId: string,
  items: Invoice["items"],
): Promise<void> {
  await database
    .delete(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId));
  if (items.length === 0) {
    return;
  }
  await database.insert(invoiceItems).values(
    items.map((line) => ({
      id: randomUUID(),
      invoiceId,
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
}

/**
 * Insert an already-issued historical invoice without consuming numbering.
 * Skips on `(issuerId, number)` or `externalKey` collision.
 */
export async function insertIssuedImport(
  database: InvoiceyDb,
  input: InsertIssuedImportInput,
): Promise<InsertIssuedImportResult> {
  const issuerRows = await database
    .select({ id: issuerBusinesses.id })
    .from(issuerBusinesses)
    .where(
      and(
        eq(issuerBusinesses.id, input.issuerId),
        eq(issuerBusinesses.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!issuerRows[0]) {
    return { ok: false, error: "issuer_not_found" };
  }

  const existingExternal = await database
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.workspaceId, input.workspaceId),
        eq(invoices.externalKey, input.externalKey),
      ),
    )
    .limit(1);
  if (existingExternal[0]) {
    return {
      ok: true,
      invoiceId: existingExternal[0].id,
      created: false,
      reason: "duplicate_external_key",
    };
  }

  let number: string;
  let issueDate: string;
  let dueDate: string;
  let duzp: string | null;
  let docType: string;
  let currency: string;
  let total: string;
  let subtotal: string;
  let vatTotal: string;
  let clientName: string;
  let notes: string | null;
  let payloadJson: Record<string, unknown>;
  let clientSnapshot: Record<string, unknown>;
  let items: Invoice["items"];
  let paymentAccountIban: string | null = null;
  let paymentVariableSymbol: string | null = null;

  if (input.completeness === "full") {
    const parsed = InvoiceSchema.safeParse(input.invoice);
    if (!parsed.success) {
      return { ok: false, error: "invalid_invoice_payload" };
    }
    const invoice = parsed.data;
    number = invoice.meta.number;
    issueDate = invoice.meta.issueDate;
    dueDate = invoice.meta.dueDate;
    duzp = invoice.meta.duzp;
    docType = invoice.meta.docType;
    currency = invoice.meta.currency;
    total = String(invoice.totals.total);
    subtotal = String(invoice.totals.subtotal);
    vatTotal = String(invoice.totals.vatTotal);
    clientName = invoice.client.name;
    notes = invoice.notes ?? null;
    payloadJson = invoice as unknown as Record<string, unknown>;
    clientSnapshot = invoice.client as unknown as Record<string, unknown>;
    items = invoice.items;
    paymentAccountIban =
      invoice.payment.bankAccount?.iban.replace(/\s+/gu, "").toUpperCase() ??
      null;
    paymentVariableSymbol = invoice.payment.variableSymbol ?? null;
  } else {
    const parsed = ArchiveInvoicePayloadSchema.safeParse(input.archive);
    if (!parsed.success) {
      return { ok: false, error: "invalid_archive_payload" };
    }
    const archive = parsed.data;
    number = archive.meta.number;
    issueDate = archive.meta.issueDate;
    dueDate = archive.meta.dueDate;
    duzp = archive.meta.duzp ?? archive.meta.issueDate;
    docType = archive.meta.docType;
    currency = archive.meta.currency ?? "CZK";
    total = String(archive.totals.total);
    subtotal = String(archive.totals.subtotal);
    vatTotal = String(archive.totals.vatTotal);
    clientName = archive.client.name;
    notes = archive.notes ?? null;
    payloadJson = archive as unknown as Record<string, unknown>;
    const tempClientId = input.clientId ?? randomUUID();
    clientSnapshot = archiveClientSnapshot(archive, tempClientId);
    items = archiveSyntheticItems(archive);
  }

  const existingNumber = await database
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(eq(invoices.issuerId, input.issuerId), eq(invoices.number, number)),
    )
    .limit(1);
  if (existingNumber[0]) {
    return {
      ok: true,
      invoiceId: existingNumber[0].id,
      created: false,
      reason: "duplicate_number",
    };
  }

  const clientId = await ensureClient(
    database,
    input.workspaceId,
    clientSnapshot,
    {
      preferredId:
        input.clientId ??
        (typeof clientSnapshot.id === "string" ? clientSnapshot.id : undefined),
      source: "import",
    },
  );
  clientSnapshot = { ...clientSnapshot, id: clientId };
  if (input.completeness === "full") {
    payloadJson = {
      ...payloadJson,
      client: { ...(payloadJson.client as object), id: clientId },
      issuer: input.issuerSnapshot,
    };
  }

  const invoiceId = randomUUID();
  const now = new Date();
  const issuedAt = issuedAtFromDate(issueDate);

  await database.insert(invoices).values({
    id: invoiceId,
    workspaceId: input.workspaceId,
    issuerId: input.issuerId,
    clientId,
    docType,
    number,
    issueDate,
    dueDate,
    duzp,
    issuedAt,
    paidAt: input.paidAt ?? null,
    paidAmount: input.paidAt ? String(Math.abs(Number(total))) : "0.00",
    paymentState: input.paidAt ? "paid" : "unpaid",
    paymentAccountIban,
    paymentVariableSymbol,
    cancelledAt: null,
    currency,
    total,
    subtotal,
    vatTotal,
    clientName,
    notes,
    issuerSnapshot: input.issuerSnapshot as unknown as Record<string, unknown>,
    clientSnapshot,
    payloadJson,
    pdfUrl: input.pdfUrl,
    isdocUrl: input.isdocUrl ?? null,
    pdfGeneratedAt: now,
    originProvider: input.origin.provider,
    originLabel: input.origin.label ?? null,
    originVersion: input.origin.version ?? null,
    importCompleteness: input.completeness,
    importBatchId: input.importBatchId,
    importedAt: now,
    externalKey: input.externalKey,
    artifactsImmutable: 1,
    createdAt: now,
    updatedAt: now,
  });

  await replaceItems(database, invoiceId, items);
  if (input.paidAt && Math.abs(Number(total)) > 0) {
    const effectiveDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Prague",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(input.paidAt);
    await database.insert(invoicePaymentAllocations).values({
      workspaceId: input.workspaceId,
      invoiceId,
      source: "legacy_manual",
      amount: String(Math.abs(Number(total))),
      currency,
      effectiveDate,
    });
  }

  return { ok: true, invoiceId, created: true };
}

/** Raise numbering counter to at least the highest imported numeric hint for issuer/docType/year. */
export async function syncNumberingCounterAfterImport(
  database: InvoiceyDb,
  options: {
    workspaceId: string;
    issuerId: string;
    docType: string;
  },
): Promise<void> {
  const schemes = await database
    .select()
    .from(issuerNumberingSchemes)
    .where(
      and(
        eq(issuerNumberingSchemes.issuerId, options.issuerId),
        eq(issuerNumberingSchemes.docType, options.docType),
        eq(issuerNumberingSchemes.workspaceId, options.workspaceId),
      ),
    )
    .limit(1);
  const scheme = schemes[0];
  if (!scheme) {
    return;
  }

  const rows = await database
    .select({ number: invoices.number, issueDate: invoices.issueDate })
    .from(invoices)
    .where(
      and(
        eq(invoices.issuerId, options.issuerId),
        eq(invoices.docType, options.docType),
        eq(invoices.workspaceId, options.workspaceId),
        isNotNull(invoices.number),
        isNotNull(invoices.issuedAt),
      ),
    );

  let maxCounter = scheme.counter;
  let maxYear = scheme.counterYear ?? undefined;
  for (const row of rows) {
    if (!row.number) {
      continue;
    }
    const hint = extractCounterHint(row.number, row.issueDate);
    if (hint == null) {
      continue;
    }
    const year = Number(row.issueDate.slice(0, 4));
    if (scheme.resetPeriod === "yearly") {
      if (
        maxYear == null ||
        year > maxYear ||
        (year === maxYear && hint > maxCounter)
      ) {
        if (year !== maxYear) {
          maxCounter = hint;
          maxYear = year;
        } else if (hint > maxCounter) {
          maxCounter = hint;
        }
      }
    } else if (hint > maxCounter) {
      maxCounter = hint;
    }
  }

  if (
    maxCounter > scheme.counter ||
    (maxYear != null && maxYear !== scheme.counterYear)
  ) {
    await database
      .update(issuerNumberingSchemes)
      .set({
        counter: maxCounter,
        counterYear: maxYear ?? scheme.counterYear,
        updatedAt: new Date(),
      })
      .where(eq(issuerNumberingSchemes.id, scheme.id));
  }
}

export async function createImportBatch(
  database: InvoiceyDb,
  input: {
    workspaceId: string;
    issuerId: string;
    origin: InvoiceOrigin;
    defaultPaid: boolean;
  },
): Promise<string> {
  const id = randomUUID();
  await database.insert(invoiceImportBatches).values({
    id,
    workspaceId: input.workspaceId,
    issuerId: input.issuerId,
    originProvider: input.origin.provider,
    originLabel: input.origin.label ?? null,
    originVersion: input.origin.version ?? null,
    defaultPaid: input.defaultPaid ? 1 : 0,
    createdCount: 0,
    skippedCount: 0,
    failedCount: 0,
    createdAt: new Date(),
  });
  return id;
}

export async function finalizeImportBatch(
  database: InvoiceyDb,
  batchId: string,
  counts: { created: number; skipped: number; failed: number },
): Promise<void> {
  await database
    .update(invoiceImportBatches)
    .set({
      createdCount: counts.created,
      skippedCount: counts.skipped,
      failedCount: counts.failed,
    })
    .where(eq(invoiceImportBatches.id, batchId));
}

export { buildExternalKey };
