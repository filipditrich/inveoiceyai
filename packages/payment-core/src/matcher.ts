import { absoluteDecimal, decimalToMinor, minorToDecimal } from "./money";
import type { NormalizedBankTransaction } from "./types";

export type MatchConfidence = "high" | "medium" | "low";

export type MatchReason =
  | "receiving_account"
  | "currency"
  | "exact_variable_symbol"
  | "exact_outstanding_amount"
  | "partial_amount"
  | "overpayment"
  | "known_client_account"
  | "plausible_date";

export type MatchBlocker = "ambiguous_variable_symbol";

export interface MatchableInvoice {
  id: string;
  clientId: string;
  issueDate: string;
  issuedAt: Date | null;
  cancelledAt: Date | null;
  total: string;
  outstanding: string;
  currency: string;
  paymentAccountIban: string | null;
  paymentVariableSymbol: string | null;
  knownClientAccounts?: string[];
}

export interface MatchProposal {
  invoiceId: string;
  proposedAmount: string;
  currency: string;
  score: number;
  confidence: MatchConfidence;
  reasons: MatchReason[];
  blockers: MatchBlocker[];
}

function normalizeAccount(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/\s+/gu, "").toUpperCase();
}

function plausibleDate(
  invoice: MatchableInvoice,
  bookingDate: string,
): boolean {
  const issue = new Date(`${invoice.issueDate}T00:00:00.000Z`);
  issue.setUTCDate(issue.getUTCDate() - 2);
  return bookingDate >= issue.toISOString().slice(0, 10);
}

export function derivePaymentState(input: {
  total: string;
  allocated: string;
}): {
  state: "unpaid" | "partial" | "paid" | "overpaid";
  target: string;
  outstanding: string;
} {
  const targetMinor = decimalToMinor(absoluteDecimal(input.total));
  const allocatedMinor = decimalToMinor(input.allocated);
  const outstandingMinor =
    targetMinor > allocatedMinor ? targetMinor - allocatedMinor : BigInt(0);
  const state =
    allocatedMinor <= BigInt(0)
      ? "unpaid"
      : allocatedMinor < targetMinor
        ? "partial"
        : allocatedMinor === targetMinor
          ? "paid"
          : "overpaid";
  return {
    state,
    target: minorToDecimal(targetMinor),
    outstanding: minorToDecimal(outstandingMinor),
  };
}

export function proposeInvoiceMatches(input: {
  transaction: NormalizedBankTransaction;
  receivingIban: string;
  invoices: MatchableInvoice[];
}): MatchProposal[] {
  const transaction = input.transaction;
  if (transaction.direction !== "credit") return [];
  const incomingMinor = decimalToMinor(transaction.amount);
  if (incomingMinor <= BigInt(0)) return [];
  const receivingIban = normalizeAccount(input.receivingIban);
  const candidates = input.invoices.filter((invoice) => {
    if (!invoice.issuedAt || invoice.cancelledAt) return false;
    if (decimalToMinor(invoice.total) <= BigInt(0)) return false;
    if (decimalToMinor(invoice.outstanding) <= BigInt(0)) return false;
    if (invoice.currency.toUpperCase() !== transaction.currency.toUpperCase()) {
      return false;
    }
    return normalizeAccount(invoice.paymentAccountIban) === receivingIban;
  });
  const exactVs = transaction.variableSymbol
    ? candidates.filter(
        (invoice) =>
          invoice.paymentVariableSymbol === transaction.variableSymbol,
      )
    : [];

  const proposals: MatchProposal[] = [];
  for (const invoice of candidates) {
    const outstandingMinor = decimalToMinor(invoice.outstanding);
    const reasons: MatchReason[] = ["receiving_account", "currency"];
    const blockers: MatchBlocker[] = [];
    let score = 0;

    if (
      transaction.variableSymbol &&
      invoice.paymentVariableSymbol === transaction.variableSymbol
    ) {
      reasons.push("exact_variable_symbol");
      score += 70;
      if (exactVs.length > 1) {
        blockers.push("ambiguous_variable_symbol");
        score = 45;
      }
    }

    if (incomingMinor === outstandingMinor) {
      reasons.push("exact_outstanding_amount");
      score += 25;
    } else if (incomingMinor < outstandingMinor) {
      reasons.push("partial_amount");
      score += 15;
    } else {
      reasons.push("overpayment");
      score += 10;
    }

    const counterparty = normalizeAccount(transaction.counterpartyAccount);
    const knownAccounts = new Set(
      (invoice.knownClientAccounts ?? []).map(normalizeAccount),
    );
    if (counterparty && knownAccounts.has(counterparty)) {
      reasons.push("known_client_account");
      score += 30;
    }
    if (plausibleDate(invoice, transaction.bookingDate)) {
      reasons.push("plausible_date");
      score += 5;
    }

    const hasExactVs = reasons.includes("exact_variable_symbol");
    const hasKnownAccount = reasons.includes("known_client_account");
    const exactAmount = reasons.includes("exact_outstanding_amount");
    if (!hasExactVs && !(hasKnownAccount && exactAmount)) {
      score = exactAmount ? 30 : Math.min(score, 20);
    }
    const confidence: MatchConfidence =
      blockers.length > 0 || score < 60
        ? "low"
        : score >= 90
          ? "high"
          : "medium";
    proposals.push({
      invoiceId: invoice.id,
      proposedAmount: minorToDecimal(
        incomingMinor > outstandingMinor ? outstandingMinor : incomingMinor,
      ),
      currency: invoice.currency,
      score: Math.min(score, 100),
      confidence,
      reasons,
      blockers,
    });
  }

  return proposals
    .filter((proposal) => proposal.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.invoiceId.localeCompare(b.invoiceId),
    );
}
