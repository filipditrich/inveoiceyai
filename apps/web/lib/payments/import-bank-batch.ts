import "server-only";

import {
  confirmPaymentMatchProposal,
  bankAccountIssuers,
  bankAccounts,
  bankConnections,
  bankTransactions,
  incomingInvoices,
  invoicePaymentAllocations,
  invoices,
  payableMatchProposals,
  payablePaymentAllocations,
  paymentMatchProposals,
  paymentRunLines,
  supplierBankAccounts,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { sendPaymentReceivedEmailIfEnabled } from "@invoicey/invoice-tools/email";
import {
  isExactAutoMatchProposal,
  proposeInvoiceMatches,
  proposePayableMatches,
  type BankProvider,
  type NormalizedTransactionBatch,
} from "@invoicey/payment-core";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { sendAutoMatchOwnerEmail } from "./send-auto-match-email";

export type BankSyncImportResult = {
  imported: number;
  proposed: number;
  autoMatched: number;
};

/** Persist statement rows and run matching. Debits only when importScope is `all`. */
export async function importBankTransactionBatch(input: {
  workspaceId: string;
  bankAccountId: string;
  receivingIban: string;
  provider: BankProvider;
  matcherVersion: string;
  batch: NormalizedTransactionBatch;
  autoConfirmExactMatches: boolean;
  createdByUserId: string;
  logPrefix: string;
  importScope?: string;
}): Promise<BankSyncImportResult> {
  const persistDebits = input.importScope === "all";
  const toPersist = input.batch.transactions.filter(
    (transaction) => transaction.direction === "credit" || persistDebits,
  );
  const credits = toPersist.filter(
    (transaction) => transaction.direction === "credit",
  );
  const inserted = toPersist.length
    ? await db
        .insert(bankTransactions)
        .values(
          toPersist.map((transaction) => ({
            workspaceId: input.workspaceId,
            bankAccountId: input.bankAccountId,
            provider: input.provider,
            providerTransactionId: transaction.providerTransactionId,
            bookedDate: transaction.bookingDate,
            amount: transaction.amount,
            currency: transaction.currency,
            direction: transaction.direction,
            counterpartyAccount: transaction.counterpartyAccount,
            counterpartyBankCode: transaction.counterpartyBankCode,
            counterpartyName: transaction.counterpartyName,
            variableSymbol: transaction.variableSymbol,
            constantSymbol: transaction.constantSymbol,
            specificSymbol: transaction.specificSymbol,
            message:
              transaction.message ??
              transaction.userIdentification ??
              transaction.comment,
            transactionType: transaction.providerType,
            providerReference:
              transaction.providerInstructionId ?? transaction.payerReference,
            payloadHash: transaction.providerPayloadHash,
          })),
        )
        .onConflictDoNothing()
        .returning({
          id: bankTransactions.id,
          providerTransactionId: bankTransactions.providerTransactionId,
        })
    : [];

  const issuerLinks = await db
    .select({ issuerId: bankAccountIssuers.issuerId })
    .from(bankAccountIssuers)
    .where(eq(bankAccountIssuers.bankAccountId, input.bankAccountId));
  const invoiceRows = issuerLinks.length
    ? await db
        .select({
          id: invoices.id,
          clientId: invoices.clientId,
          issueDate: invoices.issueDate,
          issuedAt: invoices.issuedAt,
          cancelledAt: invoices.cancelledAt,
          total: invoices.total,
          outstanding: sql<string>`greatest(abs(${invoices.total}) - ${invoices.paidAmount}, 0)::text`,
          currency: invoices.currency,
          paymentAccountIban: invoices.paymentAccountIban,
          paymentVariableSymbol: invoices.paymentVariableSymbol,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.workspaceId, input.workspaceId),
            inArray(
              invoices.issuerId,
              issuerLinks.map((link) => link.issuerId),
            ),
            isNull(invoices.cancelledAt),
            sql`${invoices.issuedAt} IS NOT NULL`,
            sql`${invoices.paidAmount} < abs(${invoices.total})`,
          ),
        )
    : [];

  /** retry unallocated credits from this batch, not only newly inserted rows */
  const storedMatchableTransactions = credits.length
    ? await db
        .select({
          id: bankTransactions.id,
          providerTransactionId: bankTransactions.providerTransactionId,
        })
        .from(bankTransactions)
        .where(
          and(
            eq(bankTransactions.bankAccountId, input.bankAccountId),
            inArray(
              bankTransactions.providerTransactionId,
              credits.map((transaction) => transaction.providerTransactionId),
            ),
            sql`not exists (
              select 1
              from ${invoicePaymentAllocations}
              where ${invoicePaymentAllocations.bankTransactionId} = ${bankTransactions.id}
                and ${invoicePaymentAllocations.reversedAt} is null
            )`,
          ),
        )
    : [];
  const matchableByProviderId = new Map(
    storedMatchableTransactions.map((row) => [
      row.providerTransactionId,
      row.id,
    ]),
  );

  let proposed = 0;
  let autoMatched = 0;
  for (const transaction of credits) {
    const bankTransactionId = matchableByProviderId.get(
      transaction.providerTransactionId,
    );
    if (!bankTransactionId) continue;
    const proposals = proposeInvoiceMatches({
      transaction,
      receivingIban: input.receivingIban,
      invoices: invoiceRows,
    });
    if (proposals.length === 0) continue;
    const insertedProposals = await db
      .insert(paymentMatchProposals)
      .values(
        proposals.map((proposal) => ({
          workspaceId: input.workspaceId,
          bankTransactionId,
          invoiceId: proposal.invoiceId,
          proposedAmount: proposal.proposedAmount,
          score: proposal.score,
          confidence: proposal.confidence,
          reasonCodes: proposal.reasons,
          blockerCodes: proposal.blockers,
          matcherVersion: input.matcherVersion,
        })),
      )
      .onConflictDoNothing()
      .returning({
        id: paymentMatchProposals.id,
        invoiceId: paymentMatchProposals.invoiceId,
      });
    proposed += insertedProposals.length;
    if (!input.autoConfirmExactMatches) continue;
    const proposalByInvoiceId = new Map(
      proposals.map((proposal) => [proposal.invoiceId, proposal]),
    );
    for (const insertedProposal of insertedProposals) {
      const proposal = proposalByInvoiceId.get(insertedProposal.invoiceId);
      if (!proposal || !isExactAutoMatchProposal(proposal)) continue;
      const confirmation = await confirmPaymentMatchProposal({
        workspaceId: input.workspaceId,
        proposalId: insertedProposal.id,
        actorType: "system",
      });
      if (!confirmation.ok) continue;
      autoMatched += 1;
      if (!confirmation.becamePaid) continue;
      try {
        await Promise.all([
          sendAutoMatchOwnerEmail({
            workspaceId: input.workspaceId,
            userId: input.createdByUserId,
            invoiceId: confirmation.invoiceId,
            amount: proposal.proposedAmount,
            bookedDate: transaction.bookingDate,
            variableSymbol: transaction.variableSymbol,
          }),
          sendPaymentReceivedEmailIfEnabled({
            db,
            workspaceId: input.workspaceId,
            invoiceId: confirmation.invoiceId,
          }),
        ]);
      } catch (error) {
        console.error(`[${input.logPrefix}] auto-match email failed`, error);
      }
    }
  }

  if (persistDebits) {
    proposed += await proposePayableMatchesForBatch({
      workspaceId: input.workspaceId,
      bankAccountId: input.bankAccountId,
      payingIban: input.receivingIban,
      matcherVersion: `${input.matcherVersion}-payable`,
      transactions: input.batch.transactions.filter(
        (transaction) => transaction.direction === "debit",
      ),
    });
  }

  await db
    .update(bankAccounts)
    .set({
      balance: input.batch.account.closingBalance,
      balanceUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bankAccounts.id, input.bankAccountId));

  return {
    imported: inserted.length,
    proposed,
    autoMatched,
  };
}

export async function markBankSyncSucceeded(input: {
  connectionId: string;
  syncCoverageThrough: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  await db
    .update(bankConnections)
    .set({
      leaseUntil: null,
      syncCoverageThrough: input.syncCoverageThrough,
      lastSyncSucceededAt: now,
      lastSyncErrorCode: null,
      consecutiveFailureCount: 0,
      nextSyncAt: new Date(now.getTime() + 15 * 60_000),
      updatedAt: now,
    })
    .where(eq(bankConnections.id, input.connectionId));
}

export async function markBankSyncFailed(input: {
  connectionId: string;
  errorCode: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  await db
    .update(bankConnections)
    .set({
      leaseUntil: null,
      lastSyncErrorCode: input.errorCode,
      consecutiveFailureCount: sql`${bankConnections.consecutiveFailureCount} + 1`,
      nextSyncAt: new Date(now.getTime() + 30 * 60_000),
      updatedAt: now,
    })
    .where(eq(bankConnections.id, input.connectionId));
}

async function proposePayableMatchesForBatch(input: {
  workspaceId: string;
  bankAccountId: string;
  payingIban: string;
  matcherVersion: string;
  transactions: NormalizedTransactionBatch["transactions"];
}): Promise<number> {
  const debits = input.transactions;
  if (debits.length === 0) return 0;

  const issuerLinks = await db
    .select({ issuerId: bankAccountIssuers.issuerId })
    .from(bankAccountIssuers)
    .where(eq(bankAccountIssuers.bankAccountId, input.bankAccountId));
  if (issuerLinks.length === 0) return 0;

  const payableRows = await db
    .select({
      id: incomingInvoices.id,
      supplierId: incomingInvoices.supplierId,
      dueDate: incomingInvoices.dueDate,
      issueDate: incomingInvoices.issueDate,
      cancelledAt: incomingInvoices.cancelledAt,
      status: incomingInvoices.status,
      total: incomingInvoices.total,
      outstanding: sql<string>`greatest(abs(coalesce(${incomingInvoices.total}, 0)) - ${incomingInvoices.paidAmount}, 0)::text`,
      currency: incomingInvoices.currency,
      variableSymbol: incomingInvoices.variableSymbol,
      beneficiaryIban: incomingInvoices.beneficiaryIban,
    })
    .from(incomingInvoices)
    .where(
      and(
        eq(incomingInvoices.workspaceId, input.workspaceId),
        inArray(
          incomingInvoices.issuerId,
          issuerLinks.map((link) => link.issuerId),
        ),
        eq(incomingInvoices.status, "approved"),
        isNull(incomingInvoices.cancelledAt),
        sql`${incomingInvoices.paidAmount} < abs(coalesce(${incomingInvoices.total}, 0))`,
      ),
    );
  if (payableRows.length === 0) return 0;

  const supplierIds = payableRows
    .map((row) => row.supplierId)
    .filter((id): id is string => Boolean(id));
  const knownAccounts = supplierIds.length
    ? await db
        .select({
          supplierId: supplierBankAccounts.supplierId,
          iban: supplierBankAccounts.iban,
          accountNumber: supplierBankAccounts.accountNumber,
          bankCode: supplierBankAccounts.bankCode,
        })
        .from(supplierBankAccounts)
        .where(inArray(supplierBankAccounts.supplierId, supplierIds))
    : [];
  const accountsBySupplier = new Map<string, string[]>();
  for (const account of knownAccounts) {
    const list = accountsBySupplier.get(account.supplierId) ?? [];
    if (account.iban) list.push(account.iban);
    if (account.accountNumber && account.bankCode) {
      list.push(`${account.accountNumber}/${account.bankCode}`);
    }
    accountsBySupplier.set(account.supplierId, list);
  }

  const runLines = await db
    .select({
      incomingInvoiceId: paymentRunLines.incomingInvoiceId,
      amount: paymentRunLines.amount,
      variableSymbol: paymentRunLines.variableSymbol,
      beneficiaryIban: paymentRunLines.beneficiaryIban,
    })
    .from(paymentRunLines)
    .where(
      and(
        eq(paymentRunLines.workspaceId, input.workspaceId),
        eq(paymentRunLines.status, "submitted"),
        inArray(
          paymentRunLines.incomingInvoiceId,
          payableRows.map((row) => row.id),
        ),
      ),
    );
  const runByInvoice = new Map(
    runLines.map((line) => [line.incomingInvoiceId, line]),
  );

  const stored = await db
    .select({
      id: bankTransactions.id,
      providerTransactionId: bankTransactions.providerTransactionId,
    })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, input.bankAccountId),
        inArray(
          bankTransactions.providerTransactionId,
          debits.map((transaction) => transaction.providerTransactionId),
        ),
        sql`not exists (
          select 1
          from ${payablePaymentAllocations}
          where ${payablePaymentAllocations.bankTransactionId} = ${bankTransactions.id}
            and ${payablePaymentAllocations.reversedAt} is null
        )`,
      ),
    );
  const matchableByProviderId = new Map(
    stored.map((row) => [row.providerTransactionId, row.id]),
  );

  let proposed = 0;
  for (const transaction of debits) {
    const bankTransactionId = matchableByProviderId.get(
      transaction.providerTransactionId,
    );
    if (!bankTransactionId) continue;
    const proposals = proposePayableMatches({
      transaction,
      payingIban: input.payingIban,
      payables: payableRows.map((row) => ({
        ...row,
        total: row.total ?? "0.00",
        knownSupplierAccounts: row.supplierId
          ? (accountsBySupplier.get(row.supplierId) ?? [])
          : [],
        submittedRunLine: runByInvoice.get(row.id) ?? null,
      })),
    });
    if (proposals.length === 0) continue;
    const insertedProposals = await db
      .insert(payableMatchProposals)
      .values(
        proposals.map((proposal) => ({
          workspaceId: input.workspaceId,
          bankTransactionId,
          incomingInvoiceId: proposal.incomingInvoiceId,
          proposedAmount: proposal.proposedAmount,
          score: proposal.score,
          confidence: proposal.confidence,
          reasonCodes: proposal.reasons,
          blockerCodes: proposal.blockers,
          matcherVersion: input.matcherVersion,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: payableMatchProposals.id });
    proposed += insertedProposals.length;
  }
  return proposed;
}
