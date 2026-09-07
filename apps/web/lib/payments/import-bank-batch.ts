import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  confirmPaymentMatchProposal,
  bankAccountIssuers,
  bankAccounts,
  bankConnections,
  bankTransactions,
  invoicePaymentAllocations,
  invoices,
  paymentMatchProposals,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { sendPaymentReceivedEmailIfEnabled } from "@invoicey/invoice-tools/email";
import {
  isExactAutoMatchProposal,
  proposeInvoiceMatches,
  type BankProvider,
  type NormalizedTransactionBatch,
} from "@invoicey/payment-core";

import { sendAutoMatchOwnerEmail } from "./send-auto-match-email";

export type BankSyncImportResult = {
  imported: number;
  proposed: number;
  autoMatched: number;
  /**
   * Proposals raised by this run that a human still has to decide on, and
   * credits this run stored that matched nothing at all.
   *
   * Both lists are deliberately built from rows this run actually inserted.
   * Every sync re-reads a two-day overlap window, so a set built from "what is
   * currently open" would re-announce the same payment on every run; both
   * inserts use `onConflictDoNothing`, which makes "was inserted" the natural
   * once-only signal.
   */
  pendingProposalIds: string[];
  unmatchedTransactionIds: string[];
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

  const insertedProviderIds = new Set(
    inserted.map((row) => row.providerTransactionId),
  );
  let proposed = 0;
  let autoMatched = 0;
  const pendingProposalIds: string[] = [];
  const unmatchedTransactionIds: string[] = [];
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
    if (proposals.length === 0) {
      if (insertedProviderIds.has(transaction.providerTransactionId)) {
        unmatchedTransactionIds.push(bankTransactionId);
      }
      continue;
    }
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
    if (!input.autoConfirmExactMatches) {
      pendingProposalIds.push(...insertedProposals.map((row) => row.id));
      continue;
    }
    const proposalByInvoiceId = new Map(
      proposals.map((proposal) => [proposal.invoiceId, proposal]),
    );
    for (const insertedProposal of insertedProposals) {
      const proposal = proposalByInvoiceId.get(insertedProposal.invoiceId);
      if (!proposal || !isExactAutoMatchProposal(proposal)) {
        pendingProposalIds.push(insertedProposal.id);
        continue;
      }
      const confirmation = await confirmPaymentMatchProposal({
        workspaceId: input.workspaceId,
        proposalId: insertedProposal.id,
        actorType: "system",
      });
      if (!confirmation.ok) {
        pendingProposalIds.push(insertedProposal.id);
        continue;
      }
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
    pendingProposalIds,
    unmatchedTransactionIds,
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

/** Returns the post-increment failure streak, which decides whether to alert. */
export async function markBankSyncFailed(input: {
  connectionId: string;
  errorCode: string;
  now?: Date;
}): Promise<{ consecutiveFailureCount: number }> {
  const now = input.now ?? new Date();
  const [updated] = await db
    .update(bankConnections)
    .set({
      leaseUntil: null,
      lastSyncErrorCode: input.errorCode,
      consecutiveFailureCount: sql`${bankConnections.consecutiveFailureCount} + 1`,
      nextSyncAt: new Date(now.getTime() + 30 * 60_000),
      updatedAt: now,
    })
    .where(eq(bankConnections.id, input.connectionId))
    .returning({
      consecutiveFailureCount: bankConnections.consecutiveFailureCount,
    });
  return { consecutiveFailureCount: updated?.consecutiveFailureCount ?? 0 };
}
