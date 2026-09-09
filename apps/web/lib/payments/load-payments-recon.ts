import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import {
  bankTransactions,
  invoices,
  paymentAllocations,
  paymentMatchProposals,
  paymentRequests,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

import {
  pageSlice,
  PAYMENTS_PAGE_SIZE,
  type IncomingStateFilter,
  type PageSlice,
} from "./page-query";
import type { ManualPaymentInvoice } from "@/components/payments/manual-payment-dialog";
import type { AllocationHistoryRow } from "@/components/payments/payments-ledger-tables";
import type { IncomingTransactionRow } from "@/components/payments/payments-ledger-tables";
import type { SuggestedMatchRow } from "@/components/payments/payments-suggested-table";

export type PaymentsReconQuery = {
  incoming?: string;
  history?: string;
  matches?: string;
};

export type PaymentsReconData = {
  proposals: SuggestedMatchRow[];
  transactions: IncomingTransactionRow[];
  allocations: Array<
    Omit<AllocationHistoryRow, "sourceLabel"> & { source: string }
  >;
  outstandingInvoices: ManualPaymentInvoice[];
  matchesSlice: PageSlice;
  incomingSlice: PageSlice;
  historySlice: PageSlice;
  matchesTotal: number;
  incomingTotal: number;
  historyTotal: number;
};

async function countWhere(
  table:
    | typeof paymentMatchProposals
    | typeof bankTransactions
    | typeof paymentAllocations,
  where: ReturnType<typeof and> | ReturnType<typeof eq>,
): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(table)
    .where(where);
  return row?.total ?? 0;
}

function incomingAllocatedSql(exists: boolean) {
  const prefix = exists ? sql`exists` : sql`not exists`;
  return sql`${prefix}(select 1 from payment_allocations a where a.bank_transaction_id = ${bankTransactions.id} and a.reversed_at is null)`;
}

function incomingWhere(
  workspaceId: string,
  incomingState: IncomingStateFilter,
) {
  const workspaceTransactions = eq(bankTransactions.workspaceId, workspaceId);
  if (incomingState === "unmatched") {
    return and(workspaceTransactions, incomingAllocatedSql(false));
  }
  if (incomingState === "allocated") {
    return and(workspaceTransactions, incomingAllocatedSql(true));
  }
  return workspaceTransactions;
}

export async function loadPaymentsRecon(
  workspaceId: string,
  pages: {
    incoming: number;
    history: number;
    matches: number;
    incomingState: IncomingStateFilter;
  },
): Promise<PaymentsReconData> {
  const pendingMatches = and(
    eq(paymentMatchProposals.workspaceId, workspaceId),
    eq(paymentMatchProposals.status, "pending"),
  );
  const workspaceTransactions = incomingWhere(workspaceId, pages.incomingState);
  const workspaceAllocations = eq(paymentAllocations.workspaceId, workspaceId);

  const [
    matchesTotal,
    incomingTotal,
    historyTotal,
    proposals,
    transactions,
    allocations,
    outstandingInvoices,
  ] = await Promise.all([
    countWhere(paymentMatchProposals, pendingMatches),
    countWhere(bankTransactions, workspaceTransactions),
    countWhere(paymentAllocations, workspaceAllocations),
    db
      .select({
        id: paymentMatchProposals.id,
        amount: paymentMatchProposals.proposedAmount,
        score: paymentMatchProposals.score,
        confidence: paymentMatchProposals.confidence,
        reasons: paymentMatchProposals.reasonCodes,
        blockers: paymentMatchProposals.blockerCodes,
        transactionAmount: bankTransactions.amount,
        bookedDate: bankTransactions.bookedDate,
        variableSymbol: bankTransactions.variableSymbol,
        counterpartyName: bankTransactions.counterpartyName,
        invoiceId: invoices.id,
        invoiceNumber: invoices.number,
        clientName: invoices.clientName,
        currency: sql<string>`coalesce(${invoices.currency}, ${paymentRequests.currency})`,
        paymentRequestId: paymentRequests.id,
        paymentRequestMessage: paymentRequests.message,
      })
      .from(paymentMatchProposals)
      .innerJoin(
        bankTransactions,
        eq(bankTransactions.id, paymentMatchProposals.bankTransactionId),
      )
      .leftJoin(invoices, eq(invoices.id, paymentMatchProposals.invoiceId))
      .leftJoin(
        paymentRequests,
        eq(paymentRequests.id, paymentMatchProposals.paymentRequestId),
      )
      .where(pendingMatches)
      .orderBy(
        desc(paymentMatchProposals.score),
        desc(bankTransactions.bookedDate),
      )
      .limit(PAYMENTS_PAGE_SIZE)
      .offset((pages.matches - 1) * PAYMENTS_PAGE_SIZE),
    db
      .select({
        id: bankTransactions.id,
        bookedDate: bankTransactions.bookedDate,
        amount: bankTransactions.amount,
        currency: bankTransactions.currency,
        variableSymbol: bankTransactions.variableSymbol,
        counterpartyName: bankTransactions.counterpartyName,
        message: bankTransactions.message,
        allocated: sql<boolean>`exists(select 1 from payment_allocations a where a.bank_transaction_id = ${bankTransactions.id} and a.reversed_at is null)`,
      })
      .from(bankTransactions)
      .where(workspaceTransactions)
      .orderBy(
        desc(bankTransactions.bookedDate),
        desc(bankTransactions.createdAt),
      )
      .limit(PAYMENTS_PAGE_SIZE)
      .offset((pages.incoming - 1) * PAYMENTS_PAGE_SIZE),
    db
      .select({
        id: paymentAllocations.id,
        invoiceId: paymentAllocations.invoiceId,
        invoiceNumber: invoices.number,
        clientName: invoices.clientName,
        paymentRequestId: paymentAllocations.paymentRequestId,
        paymentRequestMessage: paymentRequests.message,
        amount: paymentAllocations.amount,
        currency: paymentAllocations.currency,
        effectiveDate: paymentAllocations.effectiveDate,
        source: paymentAllocations.source,
        reversedAt: paymentAllocations.reversedAt,
      })
      .from(paymentAllocations)
      .leftJoin(invoices, eq(invoices.id, paymentAllocations.invoiceId))
      .leftJoin(
        paymentRequests,
        eq(paymentRequests.id, paymentAllocations.paymentRequestId),
      )
      .where(workspaceAllocations)
      .orderBy(desc(paymentAllocations.createdAt))
      .limit(PAYMENTS_PAGE_SIZE)
      .offset((pages.history - 1) * PAYMENTS_PAGE_SIZE),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        clientName: invoices.clientName,
        currency: invoices.currency,
        outstanding: sql<string>`greatest(abs(${invoices.total}) - ${invoices.paidAmount}, 0)::text`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          isNull(invoices.cancelledAt),
          sql`${invoices.issuedAt} IS NOT NULL`,
          sql`${invoices.paidAmount} < abs(${invoices.total})`,
        ),
      )
      .orderBy(desc(invoices.issueDate)),
  ]);

  return {
    proposals,
    transactions,
    allocations,
    outstandingInvoices,
    matchesTotal,
    incomingTotal,
    historyTotal,
    matchesSlice: pageSlice(matchesTotal, pages.matches),
    incomingSlice: pageSlice(incomingTotal, pages.incoming),
    historySlice: pageSlice(historyTotal, pages.history),
  };
}
