import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { ensureClient, normalizeIco } from "./clients-repo";
import type { InvoiceyDb } from "./create-db";
import { invoiceItems, invoices, issuerBusinesses } from "./schema";
import { ensureDefaultWorkspace, getDefaultWorkspaceId } from "./workspace";

/** Line shape for denormalized `invoice_items` rows. */
export interface PersistableInvoiceItem {
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unitPriceWithoutVat: number;
  vatRate: number;
  lineSubtotal: number;
  lineVat: number;
  lineTotal: number;
}

/** Subset of InvoiceSchema fields needed for draft persistence. */
export interface PersistableInvoice {
  meta: {
    docType: string;
    number: string;
    issueDate: string;
    dueDate: string;
    duzp: string;
    currency: string;
  };
  issuer: {
    id: string;
    name: string;
    ico: string;
    vatPayer: boolean;
  } & Record<string, unknown>;
  client: {
    id: string;
    name: string;
    ico?: string;
  } & Record<string, unknown>;
  totals: { total: number; subtotal?: number; vatTotal?: number };
  items?: PersistableInvoiceItem[];
  notes?: string;
}

export interface PersistDraftInvoiceResult {
  invoiceId: string;
  issuerId: string;
  clientId: string;
}

async function replaceInvoiceItems(
  database: InvoiceyDb,
  invoiceId: string,
  items: PersistableInvoiceItem[] | undefined,
): Promise<void> {
  await database
    .delete(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId));
  if (items == null || items.length === 0) {
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

async function findIssuerIdByIco(
  database: InvoiceyDb,
  workspaceId: string,
  ico: string | undefined,
): Promise<string | null> {
  const icoNorm = normalizeIco(ico);
  if (!icoNorm) {
    return null;
  }
  const rows = await database
    .select({ id: issuerBusinesses.id })
    .from(issuerBusinesses)
    .where(
      and(
        eq(issuerBusinesses.workspaceId, workspaceId),
        sql`regexp_replace(coalesce(${issuerBusinesses.snapshot}->>'ico', ''), '\\D', '', 'g') = ${icoNorm}`,
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Upsert an issuer in this workspace only. Never updates another tenant's row;
 * mint a new id when the preferred UUID belongs to a different workspace.
 */
async function ensureIssuer(
  database: InvoiceyDb,
  workspaceId: string,
  issuerSnapshot: Record<string, unknown>,
): Promise<string> {
  const preferredId =
    typeof issuerSnapshot.id === "string" && issuerSnapshot.id.length > 0
      ? issuerSnapshot.id
      : undefined;
  const ico = normalizeIco(issuerSnapshot.ico);
  const now = new Date();
  const source = ico !== undefined ? "ares" : "manual";

  let existingId: string | null = null;
  if (preferredId) {
    const found = await database
      .select({ id: issuerBusinesses.id })
      .from(issuerBusinesses)
      .where(
        and(
          eq(issuerBusinesses.id, preferredId),
          eq(issuerBusinesses.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (found[0]) {
      existingId = found[0].id;
    }
  }
  if (!existingId) {
    existingId = await findIssuerIdByIco(database, workspaceId, ico);
  }

  if (existingId) {
    const snapshot = { ...issuerSnapshot, id: existingId };
    await database
      .update(issuerBusinesses)
      .set({
        snapshot,
        source,
        updatedAt: now,
      })
      .where(
        and(
          eq(issuerBusinesses.id, existingId),
          eq(issuerBusinesses.workspaceId, workspaceId),
        ),
      );
    return existingId;
  }

  let id = preferredId ?? randomUUID();
  if (preferredId) {
    const [taken] = await database
      .select({ id: issuerBusinesses.id })
      .from(issuerBusinesses)
      .where(eq(issuerBusinesses.id, preferredId))
      .limit(1);
    if (taken) {
      id = randomUUID();
    }
  }

  const snapshot = { ...issuerSnapshot, id };
  await database.insert(issuerBusinesses).values({
    id,
    workspaceId,
    source,
    snapshot,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/** Upsert issuer/client snapshots and insert/update draft by workspace+number. */
export async function persistDraftInvoice(
  database: InvoiceyDb,
  invoice: PersistableInvoice,
  options?: { workspaceId?: string; invoiceId?: string },
): Promise<PersistDraftInvoiceResult> {
  const workspaceId = options?.workspaceId ?? getDefaultWorkspaceId();
  await ensureDefaultWorkspace(database, { id: workspaceId });

  const now = new Date();
  const clientSnapshotBase = invoice.client as Record<string, unknown>;
  const issuerId = await ensureIssuer(
    database,
    workspaceId,
    invoice.issuer as Record<string, unknown>,
  );
  const issuerSnapshot = {
    ...(invoice.issuer as Record<string, unknown>),
    id: issuerId,
  };

  const clientId = await ensureClient(
    database,
    workspaceId,
    clientSnapshotBase,
    {
      preferredId: invoice.client.id,
      source: invoice.client.ico ? "ares" : "manual",
    },
  );
  const clientSnapshot = { ...clientSnapshotBase, id: clientId };
  const payloadJson = {
    ...(invoice as unknown as Record<string, unknown>),
    issuer: issuerSnapshot,
    client: clientSnapshot,
  };
  const payment = (payloadJson as Record<string, unknown>).payment as
    | {
        variableSymbol?: unknown;
        bankAccount?: { iban?: unknown };
      }
    | undefined;
  const paymentAccountIban =
    typeof payment?.bankAccount?.iban === "string"
      ? payment.bankAccount.iban.replace(/\s+/gu, "").toUpperCase() || null
      : null;
  const paymentVariableSymbol =
    typeof payment?.variableSymbol === "string"
      ? payment.variableSymbol.replace(/\D/gu, "") || null
      : null;

  const values = {
    workspaceId,
    issuerId,
    clientId,
    docType: invoice.meta.docType,
    number: invoice.meta.number,
    issueDate: invoice.meta.issueDate,
    dueDate: invoice.meta.dueDate,
    duzp: invoice.meta.duzp,
    issuedAt: null,
    paidAt: null,
    cancelledAt: null,
    total: invoice.totals.total.toFixed(2),
    subtotal: (invoice.totals.subtotal ?? invoice.totals.total).toFixed(2),
    vatTotal: (invoice.totals.vatTotal ?? 0).toFixed(2),
    currency: invoice.meta.currency,
    paymentAccountIban,
    paymentVariableSymbol,
    clientName: invoice.client.name,
    notes: invoice.notes ?? null,
    issuerSnapshot,
    clientSnapshot,
    payloadJson,
    updatedAt: now,
  };

  if (options?.invoiceId) {
    const byId = await database
      .select({ id: invoices.id, issuedAt: invoices.issuedAt })
      .from(invoices)
      .where(
        and(
          eq(invoices.id, options.invoiceId),
          eq(invoices.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (byId[0]) {
      if (byId[0].issuedAt != null) {
        throw new Error("cannot update issued invoice as draft");
      }
      await database
        .update(invoices)
        .set(values)
        .where(eq(invoices.id, byId[0].id));
      await replaceInvoiceItems(database, byId[0].id, invoice.items);
      return {
        invoiceId: byId[0].id,
        issuerId,
        clientId,
      };
    }
  }

  const existing = await database
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.workspaceId, workspaceId),
        eq(invoices.number, invoice.meta.number),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await database
      .update(invoices)
      .set(values)
      .where(eq(invoices.id, existing[0].id));
    await replaceInvoiceItems(database, existing[0].id, invoice.items);
    return {
      invoiceId: existing[0].id,
      issuerId,
      clientId,
    };
  }

  const invoiceId = options?.invoiceId ?? randomUUID();
  await database.insert(invoices).values({
    id: invoiceId,
    ...values,
    createdAt: now,
  });
  await replaceInvoiceItems(database, invoiceId, invoice.items);

  return { invoiceId, issuerId, clientId };
}
