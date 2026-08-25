import {
  bankAccounts,
  bankAccountIssuers,
  incomingInvoices,
  issuerBusinesses,
  paymentRunLines,
  paymentRuns,
  supplierBankAccounts,
  suppliers,
} from "@invoicey/db";
import {
  withDbTransaction,
  type DbTransaction,
} from "@invoicey/db/transaction";
import { classifyFioRail } from "@invoicey/payment-core";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { isIncomingInvoicePaymentRunEligible } from "@/lib/incoming-invoices/eligibility";
import {
  claimPaymentRunCandidates,
  paymentRunRelationshipsAreValid,
} from "@/lib/incoming-invoices/payment-run-creation";

export class EmptyPaymentRunError extends Error {}

export type CreatePaymentRunTransactionInput = {
  workspaceId: string;
  userId: string;
  issuerId: string;
  bankAccountId: string;
  currency: string;
  executionDate: string;
  name: string;
  ids: string[];
};

/**
 * Keeps every lock, conditional claim, line insert, and empty-run decision in
 * the same database transaction. This is intentionally outside a server action
 * module so its transaction contract remains directly testable.
 */
export async function createPaymentRunTransaction(
  input: CreatePaymentRunTransactionInput,
): Promise<{ id: string } | null> {
  return withDbTransaction((tx) => createPaymentRunInTransaction(tx, input));
}

async function createPaymentRunInTransaction(
  tx: DbTransaction,
  input: CreatePaymentRunTransactionInput,
): Promise<{ id: string } | null> {
  const {
    workspaceId,
    userId,
    issuerId,
    bankAccountId,
    currency,
    executionDate,
    name,
    ids,
  } = input;
  const [[issuer], [account], [accountIssuer], lockedInvoices] =
    await Promise.all([
      tx
        .select({
          id: issuerBusinesses.id,
          workspaceId: issuerBusinesses.workspaceId,
        })
        .from(issuerBusinesses)
        .where(eq(issuerBusinesses.id, issuerId))
        .limit(1),
      tx
        .select({
          id: bankAccounts.id,
          workspaceId: bankAccounts.workspaceId,
          currency: bankAccounts.currency,
        })
        .from(bankAccounts)
        .where(eq(bankAccounts.id, bankAccountId))
        .limit(1),
      tx
        .select({
          workspaceId: bankAccountIssuers.workspaceId,
          bankAccountId: bankAccountIssuers.bankAccountId,
          issuerId: bankAccountIssuers.issuerId,
        })
        .from(bankAccountIssuers)
        .where(
          and(
            eq(bankAccountIssuers.bankAccountId, bankAccountId),
            eq(bankAccountIssuers.issuerId, issuerId),
          ),
        )
        .limit(1),
      tx
        .select()
        .from(incomingInvoices)
        .where(
          and(
            eq(incomingInvoices.workspaceId, workspaceId),
            inArray(incomingInvoices.id, ids),
          ),
        )
        .orderBy(incomingInvoices.id)
        .for("update"),
    ]);
  if (
    !paymentRunRelationshipsAreValid({
      workspaceId,
      issuerId,
      bankAccountId,
      currency,
      issuer,
      bankAccount: account,
      accountIssuer,
      invoices: lockedInvoices,
      selectedInvoiceCount: ids.length,
    })
  ) {
    return null;
  }

  const [created] = await tx
    .insert(paymentRuns)
    .values({
      workspaceId,
      issuerId,
      bankAccountId,
      name,
      executionDate,
      currency,
      createdByUserId: userId,
    })
    .returning({ id: paymentRuns.id });
  if (!created) throw new Error("run_create_failed");

  const included = await addInvoicesToRun(
    tx,
    workspaceId,
    created.id,
    lockedInvoices,
    currency,
    issuerId,
  );
  if (included === 0) throw new EmptyPaymentRunError();
  await refreshRunTotalsInTransaction(tx, created.id);
  return created;
}

async function addInvoicesToRun(
  tx: DbTransaction,
  workspaceId: string,
  runId: string,
  invoices: Array<typeof incomingInvoices.$inferSelect>,
  runCurrency: string,
  issuerId: string,
): Promise<number> {
  const candidates: Array<{
    invoice: typeof incomingInvoices.$inferSelect;
    outstanding: string;
    rail: ReturnType<typeof classifyFioRail>;
    beneficiaryName: string | null;
  }> = [];
  for (const invoice of invoices) {
    const [account] = invoice.supplierBankAccountId
      ? await tx
          .select()
          .from(supplierBankAccounts)
          .where(
            and(
              eq(supplierBankAccounts.id, invoice.supplierBankAccountId),
              eq(supplierBankAccounts.workspaceId, workspaceId),
            ),
          )
          .limit(1)
      : [];
    const outstanding = String(
      Math.max(0, Number(invoice.total ?? 0) - Number(invoice.paidAmount ?? 0)),
    );
    const eligible = isIncomingInvoicePaymentRunEligible({
      status: invoice.status,
      holdUntil: invoice.holdUntil,
      paymentState: invoice.paymentState,
      outstanding,
      currency: invoice.currency,
      runCurrency,
      paymentMethod: invoice.paymentMethod,
      beneficiaryConfirmed: Boolean(account?.confirmedAt),
      hasBeneficiary: Boolean(
        invoice.beneficiaryIban ||
        (invoice.beneficiaryAccountNumber && invoice.beneficiaryBankCode),
      ),
      iban: invoice.beneficiaryIban,
      accountNumber: invoice.beneficiaryAccountNumber,
      bankCode: invoice.beneficiaryBankCode,
      activePaymentRunId: invoice.activePaymentRunId,
      docType: invoice.docType,
    });
    if (!eligible) continue;
    const rail = classifyFioRail({
      iban: invoice.beneficiaryIban,
      accountNumber: invoice.beneficiaryAccountNumber,
      bankCode: invoice.beneficiaryBankCode,
    });
    if (rail === "foreign") continue;
    const [supplier] = invoice.supplierId
      ? await tx
          .select({ name: suppliers.name })
          .from(suppliers)
          .where(
            and(
              eq(suppliers.id, invoice.supplierId),
              eq(suppliers.workspaceId, workspaceId),
            ),
          )
          .limit(1)
      : [];
    candidates.push({
      invoice,
      outstanding,
      rail,
      beneficiaryName: supplier?.name ?? invoice.supplierNameRaw,
    });
  }
  return claimPaymentRunCandidates(candidates, {
    isEligible: async () => true,
    conditionallyClaim: async ({ invoice }) => {
      const [claimed] = await tx
        .update(incomingInvoices)
        .set({ activePaymentRunId: runId, updatedAt: new Date() })
        .where(
          and(
            eq(incomingInvoices.id, invoice.id),
            eq(incomingInvoices.workspaceId, workspaceId),
            eq(incomingInvoices.issuerId, issuerId),
            isNull(incomingInvoices.activePaymentRunId),
          ),
        )
        .returning({ id: incomingInvoices.id });
      return Boolean(claimed);
    },
    insertClaimedLine: async ({
      invoice,
      outstanding,
      rail,
      beneficiaryName,
    }) => {
      await tx.insert(paymentRunLines).values({
        workspaceId,
        paymentRunId: runId,
        incomingInvoiceId: invoice.id,
        amount: outstanding,
        currency: invoice.currency,
        beneficiaryName,
        beneficiaryIban: invoice.beneficiaryIban,
        beneficiaryAccountNumber: invoice.beneficiaryAccountNumber,
        beneficiaryBankCode: invoice.beneficiaryBankCode,
        beneficiaryBic: invoice.beneficiaryBic,
        variableSymbol: invoice.variableSymbol,
        constantSymbol: invoice.constantSymbol,
        specificSymbol: invoice.specificSymbol,
        messageForRecipient: invoice.messageForRecipient,
        comment: `inv/${invoice.id.slice(0, 8)}`,
        rail,
      });
    },
  });
}

async function refreshRunTotalsInTransaction(tx: DbTransaction, runId: string) {
  const [totals] = await tx
    .select({
      total: sql<string>`coalesce(sum(${paymentRunLines.amount}) FILTER (WHERE ${paymentRunLines.status} = 'included'), 0)::text`,
      count: sql<number>`coalesce(count(*) FILTER (WHERE ${paymentRunLines.status} = 'included'), 0)`,
    })
    .from(paymentRunLines)
    .where(eq(paymentRunLines.paymentRunId, runId));
  await tx
    .update(paymentRuns)
    .set({
      totalAmount: totals?.total ?? "0",
      lineCount: Number(totals?.count ?? 0),
      updatedAt: new Date(),
    })
    .where(eq(paymentRuns.id, runId));
}
