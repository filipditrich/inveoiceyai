import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { InvoiceyDb } from "./create-db";
import { clients, invoices, issuerBusinesses } from "./schema";
import { ensureDefaultWorkspace, getDefaultWorkspaceId } from "./workspace";

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
  notes?: string;
}

export interface PersistDraftInvoiceResult {
  invoiceId: string;
  issuerId: string;
  clientId: string;
}

/** Upsert issuer/client snapshots and insert/update draft by workspace+number. */
export async function persistDraftInvoice(
  database: InvoiceyDb,
  invoice: PersistableInvoice,
  options?: { workspaceId?: string },
): Promise<PersistDraftInvoiceResult> {
  const workspaceId = options?.workspaceId ?? getDefaultWorkspaceId();
  await ensureDefaultWorkspace(database, { id: workspaceId });

  const issuerId = invoice.issuer.id;
  const clientId = invoice.client.id;
  const now = new Date();
  const issuerSnapshot = invoice.issuer as Record<string, unknown>;
  const clientSnapshot = invoice.client as Record<string, unknown>;

  const existingIssuer = await database
    .select({ id: issuerBusinesses.id })
    .from(issuerBusinesses)
    .where(eq(issuerBusinesses.id, issuerId))
    .limit(1);

  if (existingIssuer[0]) {
    await database
      .update(issuerBusinesses)
      .set({
        snapshot: issuerSnapshot,
        updatedAt: now,
      })
      .where(eq(issuerBusinesses.id, issuerId));
  } else {
    await database.insert(issuerBusinesses).values({
      id: issuerId,
      workspaceId,
      source: invoice.issuer.ico ? "ares" : "manual",
      snapshot: issuerSnapshot,
      createdAt: now,
      updatedAt: now,
    });
  }

  const existingClient = await database
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (existingClient[0]) {
    await database
      .update(clients)
      .set({
        snapshot: clientSnapshot,
        updatedAt: now,
      })
      .where(eq(clients.id, clientId));
  } else {
    await database.insert(clients).values({
      id: clientId,
      workspaceId,
      source: invoice.client.ico ? "ares" : "manual",
      snapshot: clientSnapshot,
      createdAt: now,
      updatedAt: now,
    });
  }

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
    clientName: invoice.client.name,
    notes: invoice.notes ?? null,
    issuerSnapshot,
    clientSnapshot,
    payloadJson: invoice as unknown as Record<string, unknown>,
    updatedAt: now,
  };

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
    return {
      invoiceId: existing[0].id,
      issuerId,
      clientId,
    };
  }

  const invoiceId = randomUUID();
  await database.insert(invoices).values({
    id: invoiceId,
    ...values,
    createdAt: now,
  });

  return { invoiceId, issuerId, clientId };
}
