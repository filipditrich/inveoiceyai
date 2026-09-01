import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  applyTriggerGrants,
  createManualPaymentAllocation,
  getWorkspaceEntitlements,
  invoiceItems,
  invoices,
  issuerBusinesses,
  issuerNumberingSchemes,
  reverseAllInvoicePaymentAllocations,
  tryCreateDbFromEnv,
  type AppliedGrant,
  type InvoiceyDb,
} from "@invoicey/db";
import {
  withDbTransaction,
  type DbTransaction,
} from "@invoicey/db/transaction";
import { nextInvoiceNumber } from "@invoicey/invoice-core";
import {
  ClientSnapshotSchema,
  InvoiceSchema,
  IssuerSnapshotSchema,
  type Invoice,
  type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";
import {
  deriveStatus,
  type InvoiceStatus,
} from "@invoicey/invoice-core/status";
import {
  resolveDisplayStatus,
  type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";

import { getDemoIssuer } from "./demo-issuer";
import { tryPersistInvoiceArtifacts } from "./invoice-artifacts";
import {
  loadWorkspaceLookContext,
  lookColumns,
  snapshotLookAtIssue,
} from "./look-context";
import { variableSymbolFromNumber } from "./recurring";
import { sendPaymentReceivedEmailIfEnabled } from "./send-invoice-email";
import { resolveWorkspaceId } from "./workspace-context";

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

/** Workspace default issuer, else oldest. Null when Neon has no issuer. File-only MCP still uses the demo snapshot. */
export async function resolveDefaultIssuer(options?: {
  workspaceId?: string;
}): Promise<IssuerSnapshot | null> {
  const database = tryCreateDbFromEnv();
  if (!database) {
    return getDemoIssuer();
  }
  const workspaceId = resolveWorkspaceId(options?.workspaceId);
  const defaultRows = await database
    .select()
    .from(issuerBusinesses)
    .where(
      and(
        eq(issuerBusinesses.workspaceId, workspaceId),
        eq(issuerBusinesses.isDefault, true),
      ),
    )
    .limit(1);
  const rows =
    defaultRows[0] != null
      ? defaultRows
      : await database
          .select()
          .from(issuerBusinesses)
          .where(eq(issuerBusinesses.workspaceId, workspaceId))
          .orderBy(asc(issuerBusinesses.createdAt))
          .limit(1);
  const snap = rows[0]
    ? IssuerSnapshotSchema.safeParse(rows[0].snapshot)
    : null;
  if (snap?.success) {
    return snap.data;
  }
  return null;
}

export async function listInvoices(options?: {
  workspaceId?: string;
  limit?: number;
  unpaidOnly?: boolean;
}): Promise<InvoiceSummary[]> {
  const database = requireDb();
  const workspaceId = resolveWorkspaceId(options?.workspaceId);
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
  const workspaceId = resolveWorkspaceId(options.workspaceId);
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
  const workspaceId = resolveWorkspaceId(options.workspaceId);
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
  if (row.paymentState === "paid" || row.paymentState === "overpaid") {
    return { ok: true, summary: rowToSummary(row) };
  }
  const outstanding = Math.max(
    0,
    Math.abs(Number(row.total)) - Number(row.paidAmount),
  ).toFixed(2);
  if (outstanding === "0.00") {
    return { ok: false, error: "cannot_mark_paid" };
  }
  const allocation = await createManualPaymentAllocation({
    workspaceId,
    invoiceId: options.id,
    amount: outstanding,
    effectiveDate: pragueTodayIso(),
  });
  if (!allocation.ok) return allocation;
  try {
    if (allocation.becamePaid) {
      await sendPaymentReceivedEmailIfEnabled({
        db: database,
        workspaceId,
        invoiceId: options.id,
      });
    }
  } catch (err) {
    console.error("[markInvoicePaidById] payment-received email failed", err);
  }
  const [updated] = await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, options.id))
    .limit(1);
  if (!updated) return { ok: false, error: "invoice_not_found" };
  return { ok: true, summary: rowToSummary(updated) };
}

type CancelInvoiceResult =
  | { ok: true; summary: InvoiceSummary }
  | { ok: false; error: string };

async function cancelLockedInvoice(
  tx: DbTransaction,
  options: {
    id: string;
    workspaceId: string;
  },
): Promise<CancelInvoiceResult> {
  const rows = await tx
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, options.id),
        eq(invoices.workspaceId, options.workspaceId),
      ),
    )
    .for("update")
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { ok: false, error: `invoice not found: ${options.id}` };
  }
  if (
    !row.issuedAt ||
    Number(row.paidAmount) > 0 ||
    row.paidAt ||
    row.cancelledAt
  ) {
    return { ok: false, error: "cannot_cancel" };
  }

  const now = new Date();
  await tx
    .update(invoices)
    .set({ cancelledAt: now, updatedAt: now })
    .where(
      and(
        eq(invoices.id, options.id),
        eq(invoices.workspaceId, options.workspaceId),
      ),
    );
  return {
    ok: true,
    summary: rowToSummary({ ...row, cancelledAt: now, updatedAt: now }),
  };
}

export async function cancelInvoiceById(options: {
  id: string;
  workspaceId?: string;
}): Promise<CancelInvoiceResult> {
  const workspaceId = resolveWorkspaceId(options.workspaceId);
  return withDbTransaction((tx) =>
    cancelLockedInvoice(tx, { id: options.id, workspaceId }),
  );
}

/** Clear `paidAt` (no grace window). */
export async function unmarkInvoicePaidById(options: {
  id: string;
  workspaceId?: string;
  actorUserId?: string;
}): Promise<
  { ok: true; summary: InvoiceSummary } | { ok: false; error: string }
> {
  const database = requireDb();
  const workspaceId = resolveWorkspaceId(options.workspaceId);
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
  if (row.paymentState === "unpaid" || row.cancelledAt) {
    return { ok: false, error: "cannot_unmark_paid" };
  }
  const reversal = await reverseAllInvoicePaymentAllocations({
    workspaceId,
    invoiceId: options.id,
    actorUserId: options.actorUserId,
    reason: "Marked unpaid",
  });
  if (!reversal.ok) {
    return { ok: false, error: reversal.error ?? "cannot_unmark_paid" };
  }
  const [updated] = await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, options.id))
    .limit(1);
  if (!updated) return { ok: false, error: "invoice_not_found" };
  return { ok: true, summary: rowToSummary(updated) };
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
    .where(
      and(eq(invoices.workspaceId, workspaceId), inArray(invoices.id, ids)),
    );
}

export async function bulkMarkInvoicesPaid(options: {
  ids: string[];
  workspaceId?: string;
}): Promise<BulkOpResult> {
  const workspaceId = resolveWorkspaceId(options.workspaceId);
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of options.ids) {
    const result = await markInvoicePaidById({ id, workspaceId });
    if (result.ok) {
      ok += 1;
    } else if (result.error === "cannot_mark_paid") {
      skipped += 1;
    } else {
      failed += 1;
    }
  }
  return { ok, skipped, failed };
}

export async function bulkUnmarkInvoicesPaid(options: {
  ids: string[];
  workspaceId?: string;
}): Promise<BulkOpResult> {
  const workspaceId = resolveWorkspaceId(options.workspaceId);
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of options.ids) {
    const result = await unmarkInvoicePaidById({ id, workspaceId });
    if (result.ok) {
      ok += 1;
    } else if (result.error === "cannot_unmark_paid") {
      skipped += 1;
    } else {
      failed += 1;
    }
  }
  return { ok, skipped, failed };
}

export async function bulkCancelInvoices(options: {
  ids: string[];
  workspaceId?: string;
}): Promise<BulkOpResult> {
  const workspaceId = resolveWorkspaceId(options.workspaceId);
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of options.ids) {
    const result = await cancelInvoiceById({ id, workspaceId });
    if (result.ok) {
      ok += 1;
      continue;
    }
    if (result.error === "cannot_cancel") {
      skipped += 1;
      continue;
    }
    failed += 1;
  }
  return { ok, skipped, failed };
}

export async function bulkDeleteDraftInvoices(options: {
  ids: string[];
  workspaceId?: string;
}): Promise<BulkOpResult> {
  const database = requireDb();
  const workspaceId = resolveWorkspaceId(options.workspaceId);
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
    if (row.issuedAt && !row.cancelledAt) {
      skipped += 1;
      continue;
    }
    await database
      .delete(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)));
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
  | {
      ok: true;
      summary: InvoiceSummary;
      invoice: Invoice;
      alreadyIssued: boolean;
      /**
       * Plan awards that fired on this issue (ADR 0037). Empty on every issue
       * after the first, and on plans that declare no milestone rule. Callers
       * announce these; nobody has to ask whether it was the first invoice.
       */
      grants: AppliedGrant[];
    }
  | { ok: false; error: string }
> {
  const workspaceId = resolveWorkspaceId(options.workspaceId);

  try {
    const result = await withDbTransaction(async (tx) => {
      const rows = await tx
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, options.id),
            eq(invoices.workspaceId, workspaceId),
          ),
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
          grants: [] as AppliedGrant[],
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

      const variableSymbol =
        draftParsed.data.payment.variableSymbol ??
        variableSymbolFromNumber(number);
      const invoice: Invoice = {
        ...draftParsed.data,
        meta: {
          ...draftParsed.data.meta,
          number,
        },
        issuer: issuerSnap.data,
        client: clientSnap.data,
        payment: variableSymbol
          ? { ...draftParsed.data.payment, variableSymbol }
          : draftParsed.data.payment,
      };

      const parsed = InvoiceSchema.safeParse(invoice);
      if (!parsed.success) {
        throw new Error("validation");
      }

      const lookContext = await loadWorkspaceLookContext(tx, workspaceId);
      const snapped = snapshotLookAtIssue(parsed.data, lookContext);
      if (!snapped.ok) {
        throw new Error(snapped.error);
      }

      const issuedAt = new Date();
      const now = new Date();
      await tx
        .update(invoices)
        .set({
          number,
          issuedAt,
          issuerSnapshot: snapped.invoice.issuer as unknown as Record<
            string,
            unknown
          >,
          clientSnapshot: snapped.invoice.client as unknown as Record<
            string,
            unknown
          >,
          payloadJson: snapped.invoice as unknown as Record<string, unknown>,
          ...lookColumns(snapped.invoice),
          total: String(snapped.invoice.totals.total),
          subtotal: String(snapped.invoice.totals.subtotal),
          vatTotal: String(snapped.invoice.totals.vatTotal),
          clientName: snapped.invoice.client.name,
          paymentAccountIban:
            snapped.invoice.payment.bankAccount?.iban
              .replace(/\s+/gu, "")
              .toUpperCase() ?? null,
          paymentVariableSymbol: snapped.invoice.payment.variableSymbol ?? null,
          updatedAt: now,
        })
        .where(eq(invoices.id, options.id));

      await tx
        .delete(invoiceItems)
        .where(eq(invoiceItems.invoiceId, options.id));
      await tx.insert(invoiceItems).values(
        snapped.invoice.items.map((line) => ({
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

      // Milestone award, inside the same transaction as numbering: if the
      // issue rolls back, so does the grant. No "is this the first invoice?"
      // query is needed — the ledger's unique key makes the rule fire exactly
      // once per workspace, so applying it on every issue is correct and
      // cheaper than counting (ADR 0037).
      const entitled = await getWorkspaceEntitlements(tx, workspaceId);
      const grants = entitled
        ? await applyTriggerGrants(tx, {
            workspaceId,
            entitlements: entitled.entitlements,
            trigger: "first_invoice_issued",
          })
        : [];

      return {
        grants,
        summary: rowToSummary({
          ...row,
          number,
          issuedAt,
          payloadJson: snapped.invoice as unknown as Record<string, unknown>,
          total: String(snapped.invoice.totals.total),
          subtotal: String(snapped.invoice.totals.subtotal),
          vatTotal: String(snapped.invoice.totals.vatTotal),
          clientName: snapped.invoice.client.name,
          updatedAt: now,
        }),
        invoice: snapped.invoice,
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
  const workspaceId = resolveWorkspaceId(options.workspaceId);
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

export {
  createRecurringFromInvoice,
  deleteRecurringTemplate,
  listRecurring,
  pauseRecurringSchedule,
  runDueRecurringForWorkspace,
  runScheduleNow,
  skipNextRecurring,
  type RecurringListItem,
  type RecurringOpError,
} from "./recurring-ops";
export {
  RecurringCadenceSchema,
  RecurringDayOfMonthSchema,
  variableSymbolFromNumber,
  type RecurringCadence,
} from "./recurring";
export {
  applyLookToDraftWrite,
  applyLookToNewDraft,
  invoiceForPdfRender,
  loadWorkspaceLookContext,
  lookColumns,
  snapshotLookAtIssue,
} from "./look-context";
