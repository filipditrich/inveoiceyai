import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import {
  bankAccountIssuers,
  bankAccounts,
  bankConnections,
  invoices,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  buildSpaydPayloadForAmount,
  InvoiceSchema,
} from "@invoicey/invoice-core";

import {
  resolveCollectionProgress,
  type CollectionPaymentState,
  type CollectionProgress,
} from "./invoice-collection";

export type InvoiceCollectionDetails = CollectionProgress & {
  invoiceId: string;
  connectionId: string;
  number: string;
  clientName: string;
  currency: "CZK";
  iban: string;
  accountNumber: string;
  variableSymbol: string;
  qrPayload: string;
  paymentState: CollectionPaymentState;
};

export type CollectibleInvoiceSummary = {
  invoiceId: string;
  number: string;
  clientName: string;
  requestedAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  dueDate: string;
};

function collectionPaymentState(value: string): CollectionPaymentState {
  if (value === "partial" || value === "paid" || value === "overpaid") {
    return value;
  }
  return "unpaid";
}

/**
 * Resolves one invoice to the active read-only bank connection that can watch
 * its receiving account. Tenant, issuer and IBAN all participate in the join:
 * knowing an invoice UUID is never enough to point the watcher at a connection.
 */
export async function loadInvoiceCollection(
  workspaceId: string,
  invoiceId: string,
): Promise<InvoiceCollectionDetails | null> {
  const [row] = await db
    .select({
      invoice: invoices,
      connectionId: bankConnections.id,
      accountNumber: bankAccounts.accountNumber,
      accountIban: bankAccounts.iban,
    })
    .from(invoices)
    .innerJoin(
      bankAccountIssuers,
      and(
        eq(bankAccountIssuers.issuerId, invoices.issuerId),
        eq(bankAccountIssuers.workspaceId, invoices.workspaceId),
      ),
    )
    .innerJoin(
      bankAccounts,
      and(
        eq(bankAccounts.id, bankAccountIssuers.bankAccountId),
        eq(bankAccounts.workspaceId, invoices.workspaceId),
        eq(bankAccounts.iban, invoices.paymentAccountIban),
        eq(bankAccounts.currency, "CZK"),
      ),
    )
    .innerJoin(
      bankConnections,
      and(
        eq(bankConnections.id, bankAccounts.connectionId),
        eq(bankConnections.workspaceId, invoices.workspaceId),
        eq(bankConnections.status, "active"),
        inArray(bankConnections.provider, ["fio", "moneta"]),
      ),
    )
    .where(
      and(
        eq(invoices.id, invoiceId),
        eq(invoices.workspaceId, workspaceId),
        eq(invoices.currency, "CZK"),
        isNotNull(invoices.issuedAt),
        isNull(invoices.cancelledAt),
        isNotNull(invoices.paymentAccountIban),
        isNotNull(invoices.paymentVariableSymbol),
      ),
    )
    .orderBy(desc(bankConnections.lastSyncSucceededAt))
    .limit(1);

  if (!row || !row.invoice.number || !row.invoice.paymentVariableSymbol) {
    return null;
  }

  const parsed = InvoiceSchema.safeParse(row.invoice.payloadJson);
  if (!parsed.success) return null;
  const invoice = parsed.data;
  if (
    invoice.meta.docType === "credit_note" ||
    invoice.payment.method !== "transfer" ||
    invoice.payment.bankAccount?.iban !== row.accountIban ||
    invoice.payment.variableSymbol !== row.invoice.paymentVariableSymbol
  ) {
    return null;
  }

  const paymentState = collectionPaymentState(row.invoice.paymentState);
  const progress = resolveCollectionProgress(
    row.invoice.total,
    row.invoice.paidAmount,
    paymentState,
  );
  const qrPayload = buildSpaydPayloadForAmount(
    invoice,
    Number(progress.outstandingAmount),
  );
  if (!qrPayload) return null;

  return {
    invoiceId: row.invoice.id,
    connectionId: row.connectionId,
    number: row.invoice.number,
    clientName: row.invoice.clientName,
    currency: "CZK",
    iban: row.accountIban,
    accountNumber: row.accountNumber,
    variableSymbol: row.invoice.paymentVariableSymbol,
    qrPayload,
    paymentState,
    ...progress,
  };
}

/** Issued, unpaid CZK invoices that resolve to a live watched bank account. */
export async function listCollectibleInvoices(
  workspaceId: string,
  limit: number,
): Promise<CollectibleInvoiceSummary[]> {
  const rows = await db
    .selectDistinctOn([invoices.id], {
      id: invoices.id,
      number: invoices.number,
      clientName: invoices.clientName,
      total: invoices.total,
      paidAmount: invoices.paidAmount,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .innerJoin(
      bankAccountIssuers,
      and(
        eq(bankAccountIssuers.issuerId, invoices.issuerId),
        eq(bankAccountIssuers.workspaceId, invoices.workspaceId),
      ),
    )
    .innerJoin(
      bankAccounts,
      and(
        eq(bankAccounts.id, bankAccountIssuers.bankAccountId),
        eq(bankAccounts.workspaceId, invoices.workspaceId),
        eq(bankAccounts.iban, invoices.paymentAccountIban),
        eq(bankAccounts.currency, "CZK"),
      ),
    )
    .innerJoin(
      bankConnections,
      and(
        eq(bankConnections.id, bankAccounts.connectionId),
        eq(bankConnections.workspaceId, invoices.workspaceId),
        eq(bankConnections.status, "active"),
        inArray(bankConnections.provider, ["fio", "moneta"]),
      ),
    )
    .where(
      and(
        eq(invoices.workspaceId, workspaceId),
        eq(invoices.currency, "CZK"),
        isNotNull(invoices.issuedAt),
        isNull(invoices.cancelledAt),
        isNotNull(invoices.paymentAccountIban),
        isNotNull(invoices.paymentVariableSymbol),
        sql`${invoices.paidAmount} < abs(${invoices.total})`,
      ),
    )
    .orderBy(invoices.id, desc(invoices.dueDate))
    .limit(limit);
  return rows.flatMap((row) => {
    if (!row.number) return [];
    const progress = resolveCollectionProgress(
      row.total,
      row.paidAmount,
      "unpaid",
    );
    return [
      {
        invoiceId: row.id,
        number: row.number,
        clientName: row.clientName,
        requestedAmount: row.total,
        paidAmount: progress.paidAmount,
        outstandingAmount: progress.outstandingAmount,
        dueDate: row.dueDate,
      },
    ];
  });
}
