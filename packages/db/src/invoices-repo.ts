import { and, eq } from "drizzle-orm";

import type { InvoiceyDb } from "./create-db";
import { clients, invoices, issuers } from "./schema";
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
  totals: { total: number };
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
    .select({ id: issuers.id })
    .from(issuers)
    .where(eq(issuers.id, issuerId))
    .limit(1);

  if (existingIssuer[0]) {
    await database
      .update(issuers)
      .set({
        name: invoice.issuer.name,
        ico: invoice.issuer.ico,
        vatPayer: invoice.issuer.vatPayer,
        snapshot: issuerSnapshot,
        updatedAt: now,
      })
      .where(eq(issuers.id, issuerId));
  } else {
    await database.insert(issuers).values({
      id: issuerId,
      workspaceId,
      name: invoice.issuer.name,
      ico: invoice.issuer.ico,
      vatPayer: invoice.issuer.vatPayer,
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
    currency: invoice.meta.currency,
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

  const inserted = await database
    .insert(invoices)
    .values({
      ...values,
      createdAt: now,
    })
    .returning({ id: invoices.id });

  const invoiceId = inserted[0]?.id;
  if (invoiceId == null) {
    throw new Error("failed to insert invoice");
  }

  return { invoiceId, issuerId, clientId };
}
