import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  bankAccounts,
  bankConnections,
  bankTransactions,
  invoicePaymentAllocations,
  invoices,
  paymentMatchProposals,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  renderBankSyncFailedEmail,
  renderPaymentReviewDigestEmail,
  type EmailLocale,
} from "@invoicey/emails";
import { InvoiceSchema } from "@invoicey/invoice-core/schema";
import { sendTransactionalEmail } from "@invoicey/invoice-tools/email";

import { listPaymentNotificationRecipients } from "./notify-recipients";
import {
  blockerLabels,
  confidenceLabel,
  providerLabel,
  syncErrorLabel,
} from "./payment-notification-copy";
import type {
  SlackPaymentProposal,
  SlackPaymentUnmatched,
} from "./slack-payment-card";
import { postPaymentReviewSlackCards } from "./slack-payment-dm";

/**
 * Alert on the third consecutive failure rather than the first.
 *
 * Providers occasionally 5xx, so a single miss is noise; three in a row is a
 * connection that is actually broken. Because the alert fires on the exact
 * transition it cannot repeat while the streak keeps growing.
 *
 * Rate limits never reach this counter — they are bookkept as skips, not
 * failures (see `bank-sync-outcome.ts`), so the streak counts real breakage.
 */
const SYNC_FAILURE_ALERT_THRESHOLD = 3;

/** Auth failures are terminal, not transient — waiting three runs helps nobody. */
const IMMEDIATE_ALERT_CODES = new Set([
  "fio_unauthorized",
  "fio_forbidden",
  "fio_account_changed",
  "moneta_unauthorized",
  "moneta_forbidden",
]);

export type PaymentReviewSummary = {
  workspaceId: string;
  pendingProposalIds: string[];
  unmatchedTransactionIds: string[];
};

function appOrigin(): string {
  return (
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/u, "");
}

function intlLocaleFor(locale: EmailLocale): string {
  return locale === "cs" ? "cs-CZ" : "en-US";
}

function formatMoney(
  amount: string,
  currency: string,
  locale: EmailLocale,
): string {
  return new Intl.NumberFormat(intlLocaleFor(locale), {
    style: "currency",
    currency,
  }).format(Number(amount));
}

function formatDate(bookedDate: string, locale: EmailLocale): string {
  return new Intl.DateTimeFormat(intlLocaleFor(locale), {
    dateStyle: "medium",
    timeZone: "Europe/Prague",
  }).format(new Date(`${bookedDate}T12:00:00.000Z`));
}

export type ReviewProposalRow = {
  proposalId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  proposedAmount: string;
  transactionAmount: string;
  currency: string;
  bookedDate: string;
  variableSymbol: string | null;
  counterpartyName: string | null;
  score: number;
  confidence: string;
  reasons: string[];
  blockers: string[];
  language: EmailLocale;
};

export type ReviewUnmatchedRow = {
  transactionId: string;
  amount: string;
  currency: string;
  bookedDate: string;
  counterpartyName: string | null;
  variableSymbol: string | null;
};

/**
 * Re-reads the ids the sync run reported, dropping anything already decided.
 *
 * The gap between the import finishing and the digest going out is small but
 * real, and a member watching `/payments` can confirm a proposal inside it.
 * Filtering on `status = pending` here means the notification never asks for a
 * decision that has already been made.
 */
async function loadReviewRows(summary: PaymentReviewSummary): Promise<{
  proposals: ReviewProposalRow[];
  unmatched: ReviewUnmatchedRow[];
}> {
  const proposalRows = summary.pendingProposalIds.length
    ? await db
        .select({
          proposalId: paymentMatchProposals.id,
          invoiceId: invoices.id,
          invoiceNumber: invoices.number,
          clientName: invoices.clientName,
          payloadJson: invoices.payloadJson,
          proposedAmount: paymentMatchProposals.proposedAmount,
          score: paymentMatchProposals.score,
          confidence: paymentMatchProposals.confidence,
          reasons: paymentMatchProposals.reasonCodes,
          blockers: paymentMatchProposals.blockerCodes,
          transactionAmount: bankTransactions.amount,
          currency: bankTransactions.currency,
          bookedDate: bankTransactions.bookedDate,
          variableSymbol: bankTransactions.variableSymbol,
          counterpartyName: bankTransactions.counterpartyName,
        })
        .from(paymentMatchProposals)
        .innerJoin(
          bankTransactions,
          eq(bankTransactions.id, paymentMatchProposals.bankTransactionId),
        )
        .innerJoin(invoices, eq(invoices.id, paymentMatchProposals.invoiceId))
        .where(
          and(
            eq(paymentMatchProposals.workspaceId, summary.workspaceId),
            eq(paymentMatchProposals.status, "pending"),
            inArray(paymentMatchProposals.id, summary.pendingProposalIds),
            // Confirming one proposal leaves its siblings `pending`, so a
            // transaction that has already been spent would otherwise arrive
            // as a Slack card whose Confirm button can only fail with
            // `transaction_amount_exhausted`.
            sql`not exists (
              select 1
              from ${invoicePaymentAllocations}
              where ${invoicePaymentAllocations.bankTransactionId} = ${paymentMatchProposals.bankTransactionId}
                and ${invoicePaymentAllocations.reversedAt} is null
            )`,
          ),
        )
        .orderBy(desc(paymentMatchProposals.score))
    : [];

  const unmatchedRows = summary.unmatchedTransactionIds.length
    ? await db
        .select({
          transactionId: bankTransactions.id,
          amount: bankTransactions.amount,
          currency: bankTransactions.currency,
          bookedDate: bankTransactions.bookedDate,
          counterpartyName: bankTransactions.counterpartyName,
          variableSymbol: bankTransactions.variableSymbol,
        })
        .from(bankTransactions)
        .where(
          and(
            eq(bankTransactions.workspaceId, summary.workspaceId),
            inArray(bankTransactions.id, summary.unmatchedTransactionIds),
          ),
        )
    : [];

  return {
    proposals: proposalRows.map((row) => {
      const parsed = InvoiceSchema.safeParse(row.payloadJson);
      return {
        proposalId: row.proposalId,
        invoiceId: row.invoiceId,
        invoiceNumber: row.invoiceNumber ?? "—",
        clientName: row.clientName,
        proposedAmount: row.proposedAmount,
        transactionAmount: row.transactionAmount,
        currency: row.currency,
        bookedDate: row.bookedDate,
        variableSymbol: row.variableSymbol,
        counterpartyName: row.counterpartyName,
        score: row.score,
        confidence: row.confidence,
        reasons: row.reasons,
        blockers: row.blockers,
        language:
          parsed.success && parsed.data.meta.language === "en" ? "en" : "cs",
      };
    }),
    unmatched: unmatchedRows,
  };
}

/**
 * Tells the workspace about payments it has to look at.
 *
 * This is the notification the ledger was missing. `autoConfirmExactMatches`
 * is off by default and, even when on, only fires on a flawless
 * variable-symbol-and-amount match — so the ordinary case (a payment that is
 * one glance away from being confirmed) produced no signal at all and waited
 * for somebody to happen to open `/payments`.
 */
export async function notifyPaymentReview(
  summary: PaymentReviewSummary,
): Promise<{ emailed: number; slacked: number }> {
  if (
    summary.pendingProposalIds.length === 0 &&
    summary.unmatchedTransactionIds.length === 0
  ) {
    return { emailed: 0, slacked: 0 };
  }

  const { proposals, unmatched } = await loadReviewRows(summary);
  if (proposals.length === 0 && unmatched.length === 0) {
    return { emailed: 0, slacked: 0 };
  }

  const recipients = await listPaymentNotificationRecipients({
    workspaceId: summary.workspaceId,
    permission: "payments:read",
  });
  if (recipients.length === 0) return { emailed: 0, slacked: 0 };

  /** One workspace speaks one language; the invoices in it agree in practice. */
  const locale: EmailLocale = proposals[0]?.language ?? "cs";
  const origin = appOrigin();
  const paymentsUrl = `${origin}/payments`;

  /**
   * Format once, render twice. The email and the Slack card describe the same
   * payment, so they share one set of localized labels rather than each
   * building its own `Intl` output and drifting apart.
   */
  const slackProposals: SlackPaymentProposal[] = proposals.map((proposal) => ({
    proposalId: proposal.proposalId,
    invoiceUrl: `${origin}/invoices/${proposal.invoiceId}`,
    invoiceNumber: proposal.invoiceNumber,
    clientName: proposal.clientName,
    amountLabel: formatMoney(
      proposal.transactionAmount,
      proposal.currency,
      locale,
    ),
    proposedAmountLabel: formatMoney(
      proposal.proposedAmount,
      proposal.currency,
      locale,
    ),
    bookedDateLabel: formatDate(proposal.bookedDate, locale),
    variableSymbol: proposal.variableSymbol,
    counterpartyName: proposal.counterpartyName,
    confidenceLabel: confidenceLabel(locale, proposal),
    blockerLabels: blockerLabels(locale, proposal.blockers),
  }));
  const slackUnmatched: SlackPaymentUnmatched[] = unmatched.map(
    (transaction) => ({
      amountLabel: formatMoney(
        transaction.amount,
        transaction.currency,
        locale,
      ),
      bookedDateLabel: formatDate(transaction.bookedDate, locale),
      counterpartyName: transaction.counterpartyName,
      variableSymbol: transaction.variableSymbol,
    }),
  );

  const rendered = await renderPaymentReviewDigestEmail({
    userName: "",
    locale,
    paymentsUrl,
    proposals: slackProposals.map((proposal) => ({
      invoiceNumber: proposal.invoiceNumber,
      clientName: proposal.clientName,
      amountLabel: proposal.amountLabel,
      bookedDate: proposal.bookedDateLabel,
      variableSymbol: proposal.variableSymbol,
      confidenceLabel: proposal.confidenceLabel,
      blockerLabels: proposal.blockerLabels,
    })),
    unmatched: slackUnmatched.map((transaction) => ({
      amountLabel: transaction.amountLabel,
      bookedDate: transaction.bookedDateLabel,
      counterpartyName: transaction.counterpartyName,
      variableSymbol: transaction.variableSymbol,
    })),
  });

  let emailed = 0;
  for (const recipient of recipients) {
    try {
      await sendTransactionalEmail({
        db,
        workspaceId: summary.workspaceId,
        template: "payment_review_digest",
        to: recipient.email,
        displayName: "Invoicey",
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        createdBy: recipient.userId,
      });
      emailed += 1;
    } catch (error) {
      console.error("[payment-review] digest email failed", error);
    }
  }

  const slacked = await postPaymentReviewSlackCards({
    workspaceId: summary.workspaceId,
    recipients,
    proposals: slackProposals,
    unmatched: slackUnmatched,
    locale,
    paymentsUrl,
  });

  return { emailed, slacked };
}

/**
 * Warns that the bank connection has stopped feeding the ledger.
 *
 * A lapsed Fio monitoring token fails identically forever: the streak counter
 * climbs, `/payments` keeps showing yesterday's data, and invoices that were
 * actually paid stay "unpaid" until somebody notices. Firing on the exact
 * threshold crossing keeps this to one email per outage.
 */
export async function notifyBankSyncFailure(input: {
  workspaceId: string;
  connectionId: string;
  errorCode: string;
  consecutiveFailureCount: number;
}): Promise<number> {
  const immediate = IMMEDIATE_ALERT_CODES.has(input.errorCode);
  const threshold = immediate ? 1 : SYNC_FAILURE_ALERT_THRESHOLD;
  if (input.consecutiveFailureCount !== threshold) return 0;

  const [connection] = await db
    .select({
      provider: bankConnections.provider,
      lastSyncSucceededAt: bankConnections.lastSyncSucceededAt,
      iban: bankAccounts.iban,
      accountNumber: bankAccounts.accountNumber,
    })
    .from(bankConnections)
    .leftJoin(bankAccounts, eq(bankAccounts.connectionId, bankConnections.id))
    .where(
      and(
        eq(bankConnections.id, input.connectionId),
        eq(bankConnections.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!connection) return 0;

  // Rotating a token is owner/admin work, so this goes to the people who can
  // actually act on it rather than everyone who can read the ledger.
  const recipients = await listPaymentNotificationRecipients({
    workspaceId: input.workspaceId,
    permission: "payments:manage",
  });
  if (recipients.length === 0) return 0;

  const locale: EmailLocale = "cs";
  const connectionsUrl = `${appOrigin()}/settings/workspace/bank-connections`;
  const rendered = await renderBankSyncFailedEmail({
    userName: "",
    providerLabel: providerLabel(connection.provider),
    accountLabel:
      connection.accountNumber ?? connection.iban ?? input.connectionId,
    reasonLabel: syncErrorLabel(locale, input.errorCode),
    failureCount: input.consecutiveFailureCount,
    lastSuccessLabel: connection.lastSyncSucceededAt
      ? new Intl.DateTimeFormat(intlLocaleFor(locale), {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Europe/Prague",
        }).format(connection.lastSyncSucceededAt)
      : null,
    connectionsUrl,
    locale,
  });

  let sent = 0;
  for (const recipient of recipients) {
    try {
      await sendTransactionalEmail({
        db,
        workspaceId: input.workspaceId,
        template: "bank_sync_failed",
        to: recipient.email,
        displayName: "Invoicey",
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        createdBy: recipient.userId,
      });
      sent += 1;
    } catch (error) {
      console.error("[payment-review] sync failure email failed", error);
    }
  }
  return sent;
}
