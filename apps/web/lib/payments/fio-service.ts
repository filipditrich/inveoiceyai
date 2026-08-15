import "server-only";

import {
  bankAccountIssuers,
  bankAccounts,
  bankConnections,
  bankTransactions,
  invoices,
  issuerBusinesses,
  paymentAuditEvents,
  paymentMatchProposals,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { withDbTransaction } from "@invoicey/db/transaction";
import {
  fetchFioTransactions,
  proposeInvoiceMatches,
  type NormalizedTransactionBatch,
} from "@invoicey/payment-core";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { decryptBankToken, encryptBankToken } from "./token-crypto";

const MATCHER_VERSION = "fio-v1";
const MIN_REQUEST_INTERVAL_MS = 31_000;
const LEASE_MS = 60_000;

function pragueDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type FioConnectionSummary = {
  id: string;
  status: string;
  iban: string;
  accountNumber: string;
  currency: string;
  lastSyncSucceededAt: Date | null;
  lastSyncErrorCode: string | null;
  nextSyncAt: Date | null;
};

export async function listFioConnections(
  workspaceId: string,
): Promise<FioConnectionSummary[]> {
  return db
    .select({
      id: bankConnections.id,
      status: bankConnections.status,
      iban: bankAccounts.iban,
      accountNumber: bankAccounts.accountNumber,
      currency: bankAccounts.currency,
      lastSyncSucceededAt: bankConnections.lastSyncSucceededAt,
      lastSyncErrorCode: bankConnections.lastSyncErrorCode,
      nextSyncAt: bankConnections.nextSyncAt,
    })
    .from(bankConnections)
    .innerJoin(bankAccounts, eq(bankAccounts.connectionId, bankConnections.id))
    .where(
      and(
        eq(bankConnections.workspaceId, workspaceId),
        eq(bankConnections.provider, "fio"),
      ),
    );
}

export async function testFioToken(
  token: string,
): Promise<NormalizedTransactionBatch> {
  const today = pragueDate();
  return fetchFioTransactions({ token, from: today, to: today });
}

export async function createFioConnection(input: {
  workspaceId: string;
  userId: string;
  issuerId: string;
  token: string;
  batch: NormalizedTransactionBatch;
}): Promise<string> {
  if (input.batch.account.currency !== "CZK") {
    throw new Error("fio_account_must_be_czk");
  }
  const secret = encryptBankToken(input.token);
  return withDbTransaction(async (tx) => {
    const [issuer] = await tx
      .select({ id: issuerBusinesses.id, snapshot: issuerBusinesses.snapshot })
      .from(issuerBusinesses)
      .where(
        and(
          eq(issuerBusinesses.workspaceId, input.workspaceId),
          eq(issuerBusinesses.id, input.issuerId),
        ),
      )
      .limit(1);
    if (!issuer) throw new Error("issuer_not_found");
    const updatedIssuerSnapshot = {
      ...issuer.snapshot,
      bank: {
        accountNumber: input.batch.account.accountNumber,
        iban: input.batch.account.iban,
        bic: input.batch.account.bic,
      },
    };

    const existing = await tx
      .select({
        connectionId: bankConnections.id,
        accountId: bankAccounts.id,
        workspaceId: bankAccounts.workspaceId,
      })
      .from(bankAccounts)
      .innerJoin(
        bankConnections,
        eq(bankConnections.id, bankAccounts.connectionId),
      )
      .where(
        and(
          eq(bankAccounts.provider, "fio"),
          eq(bankAccounts.iban, input.batch.account.iban),
        ),
      )
      .limit(1);
    if (existing[0] && existing[0].workspaceId !== input.workspaceId) {
      throw new Error("bank_account_already_connected_to_another_workspace");
    }
    if (existing[0]) {
      await tx
        .update(bankConnections)
        .set({
          secretCiphertext: secret.ciphertext,
          secretFingerprint: secret.fingerprint,
          keyVersion: secret.keyVersion,
          status: "active",
          lastRotatedByUserId: input.userId,
          lastSyncErrorCode: null,
          updatedAt: new Date(),
        })
        .where(eq(bankConnections.id, existing[0].connectionId));
      await tx
        .insert(bankAccountIssuers)
        .values({
          workspaceId: input.workspaceId,
          bankAccountId: existing[0].accountId,
          issuerId: input.issuerId,
        })
        .onConflictDoNothing();
      await tx
        .update(issuerBusinesses)
        .set({ snapshot: updatedIssuerSnapshot, updatedAt: new Date() })
        .where(eq(issuerBusinesses.id, input.issuerId));
      return existing[0].connectionId;
    }

    const [connection] = await tx
      .insert(bankConnections)
      .values({
        workspaceId: input.workspaceId,
        provider: "fio",
        secretCiphertext: secret.ciphertext,
        secretFingerprint: secret.fingerprint,
        keyVersion: secret.keyVersion,
        createdByUserId: input.userId,
        lastRequestAt: new Date(),
        syncCoverageThrough: input.batch.to ?? pragueDate(),
        lastSyncStartedAt: new Date(),
        lastSyncSucceededAt: new Date(),
        nextSyncAt: new Date(Date.now() + 15 * 60_000),
      })
      .returning({ id: bankConnections.id });
    if (!connection) throw new Error("fio_connection_insert_failed");
    const [account] = await tx
      .insert(bankAccounts)
      .values({
        workspaceId: input.workspaceId,
        connectionId: connection.id,
        provider: "fio",
        providerAccountId: input.batch.account.providerAccountId,
        accountNumber: input.batch.account.accountNumber,
        bankCode: input.batch.account.bankCode,
        iban: input.batch.account.iban,
        bic: input.batch.account.bic,
        currency: input.batch.account.currency,
        balance: input.batch.account.closingBalance,
        balanceUpdatedAt: new Date(),
      })
      .returning({ id: bankAccounts.id });
    if (!account) throw new Error("fio_account_insert_failed");
    await tx.insert(bankAccountIssuers).values({
      workspaceId: input.workspaceId,
      bankAccountId: account.id,
      issuerId: input.issuerId,
    });
    await tx
      .update(issuerBusinesses)
      .set({ snapshot: updatedIssuerSnapshot, updatedAt: new Date() })
      .where(eq(issuerBusinesses.id, input.issuerId));
    await tx.insert(paymentAuditEvents).values({
      workspaceId: input.workspaceId,
      action: "bank_connection.created",
      actorType: "user",
      actorUserId: input.userId,
      entityType: "bank_connection",
      entityId: connection.id,
      payloadJson: { provider: "fio", iban: input.batch.account.iban },
    });
    return connection.id;
  });
}

export type FioSyncResult = {
  ok: boolean;
  imported: number;
  proposed: number;
  error?: string;
};

export async function syncFioConnection(input: {
  workspaceId: string;
  connectionId: string;
}): Promise<FioSyncResult> {
  const now = new Date();
  const [leased] = await db
    .update(bankConnections)
    .set({
      leaseUntil: new Date(now.getTime() + LEASE_MS),
      lastSyncStartedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(bankConnections.id, input.connectionId),
        eq(bankConnections.workspaceId, input.workspaceId),
        eq(bankConnections.status, "active"),
        or(
          isNull(bankConnections.leaseUntil),
          lt(bankConnections.leaseUntil, now),
        ),
      ),
    )
    .returning();
  if (!leased)
    return { ok: false, imported: 0, proposed: 0, error: "sync_busy" };

  try {
    const [account] = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.connectionId, leased.id))
      .limit(1);
    if (!account) throw new Error("bank_account_not_found");
    if (
      leased.lastRequestAt &&
      now.getTime() - leased.lastRequestAt.getTime() < MIN_REQUEST_INTERVAL_MS
    ) {
      throw new Error("fio_throttled_locally");
    }
    const today = pragueDate(now);
    const from = leased.syncCoverageThrough
      ? shiftDate(leased.syncCoverageThrough, -2)
      : today;
    await db
      .update(bankConnections)
      .set({ lastRequestAt: now })
      .where(eq(bankConnections.id, leased.id));
    const batch = await fetchFioTransactions({
      token: decryptBankToken(leased.secretCiphertext, leased.keyVersion),
      from,
      to: today,
    });
    if (batch.account.iban !== account.iban)
      throw new Error("fio_account_changed");

    const credits = batch.transactions.filter(
      (transaction) => transaction.direction === "credit",
    );
    const inserted = credits.length
      ? await db
          .insert(bankTransactions)
          .values(
            credits.map((transaction) => ({
              workspaceId: input.workspaceId,
              bankAccountId: account.id,
              provider: "fio",
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
      .where(eq(bankAccountIssuers.bankAccountId, account.id));
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
    const insertedByProviderId = new Map(
      inserted.map((row) => [row.providerTransactionId, row.id]),
    );
    let proposed = 0;
    for (const transaction of credits) {
      const bankTransactionId = insertedByProviderId.get(
        transaction.providerTransactionId,
      );
      if (!bankTransactionId) continue;
      const proposals = proposeInvoiceMatches({
        transaction,
        receivingIban: account.iban,
        invoices: invoiceRows,
      });
      if (proposals.length > 0) {
        await db.insert(paymentMatchProposals).values(
          proposals.map((proposal) => ({
            workspaceId: input.workspaceId,
            bankTransactionId,
            invoiceId: proposal.invoiceId,
            proposedAmount: proposal.proposedAmount,
            score: proposal.score,
            confidence: proposal.confidence,
            reasonCodes: proposal.reasons,
            blockerCodes: proposal.blockers,
            matcherVersion: MATCHER_VERSION,
          })),
        );
        proposed += proposals.length;
      }
    }

    await db
      .update(bankAccounts)
      .set({
        balance: batch.account.closingBalance,
        balanceUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(bankAccounts.id, account.id));
    await db
      .update(bankConnections)
      .set({
        leaseUntil: null,
        syncCoverageThrough: batch.to ?? today,
        lastSyncSucceededAt: now,
        lastSyncErrorCode: null,
        consecutiveFailureCount: 0,
        nextSyncAt: new Date(now.getTime() + 15 * 60_000),
        updatedAt: now,
      })
      .where(eq(bankConnections.id, leased.id));
    return { ok: true, imported: inserted.length, proposed };
  } catch (error) {
    const code = error instanceof Error ? error.message : "fio_sync_failed";
    await db
      .update(bankConnections)
      .set({
        leaseUntil: null,
        lastSyncErrorCode: code,
        consecutiveFailureCount: sql`${bankConnections.consecutiveFailureCount} + 1`,
        nextSyncAt: new Date(now.getTime() + 30 * 60_000),
        updatedAt: new Date(),
      })
      .where(eq(bankConnections.id, input.connectionId));
    return { ok: false, imported: 0, proposed: 0, error: code };
  }
}

export async function deleteFioConnection(input: {
  workspaceId: string;
  connectionId: string;
  userId: string;
}): Promise<boolean> {
  const [deleted] = await db
    .update(bankConnections)
    .set({
      status: "paused",
      secretCiphertext: "disconnected",
      leaseUntil: null,
      nextSyncAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bankConnections.id, input.connectionId),
        eq(bankConnections.workspaceId, input.workspaceId),
        eq(bankConnections.provider, "fio"),
      ),
    )
    .returning({ id: bankConnections.id });
  if (!deleted) return false;
  await db.insert(paymentAuditEvents).values({
    workspaceId: input.workspaceId,
    action: "bank_connection.deleted",
    actorType: "user",
    actorUserId: input.userId,
    entityType: "bank_connection",
    entityId: deleted.id,
  });
  return true;
}
