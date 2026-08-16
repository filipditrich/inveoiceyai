import { absoluteDecimal, decimalToMinor, minorToDecimal } from "./money";
import type { NormalizedBankTransaction } from "./types";

export type PayableMatchReason =
  | "payment_run_line"
  | "exact_variable_symbol"
  | "known_supplier_account"
  | "exact_outstanding_amount"
  | "partial_amount"
  | "overpayment"
  | "paying_account"
  | "currency"
  | "plausible_date";

export type PayableMatchBlocker = "ambiguous_variable_symbol";

export type MatchablePayable = {
  id: string;
  supplierId: string | null;
  dueDate: string | null;
  issueDate: string | null;
  cancelledAt: Date | null;
  status: string;
  total: string;
  outstanding: string;
  currency: string;
  variableSymbol: string | null;
  beneficiaryIban: string | null;
  knownSupplierAccounts?: string[];
  submittedRunLine?: {
    amount: string;
    variableSymbol: string | null;
    beneficiaryIban: string | null;
  } | null;
};

export type PayableMatchProposal = {
  incomingInvoiceId: string;
  proposedAmount: string;
  currency: string;
  score: number;
  confidence: "high" | "medium" | "low";
  reasons: PayableMatchReason[];
  blockers: PayableMatchBlocker[];
};

function normalizeAccount(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/\s+/gu, "").toUpperCase();
}

export function isExactAutoMatchPayable(
  proposal: Pick<
    PayableMatchProposal,
    "score" | "confidence" | "reasons" | "blockers"
  >,
): boolean {
  const required: PayableMatchReason[] = [
    "payment_run_line",
    "exact_variable_symbol",
    "exact_outstanding_amount",
  ];
  return (
    proposal.confidence === "high" &&
    proposal.blockers.length === 0 &&
    required.every((reason) => proposal.reasons.includes(reason))
  );
}

export function proposePayableMatches(input: {
  transaction: NormalizedBankTransaction;
  payingIban: string;
  payables: MatchablePayable[];
}): PayableMatchProposal[] {
  const transaction = input.transaction;
  if (transaction.direction !== "debit") return [];
  const debitMinor = decimalToMinor(absoluteDecimal(transaction.amount));
  if (debitMinor <= BigInt(0)) return [];

  const payingIban = normalizeAccount(input.payingIban);
  const txIban = normalizeAccount(transaction.counterpartyAccount);
  const txVs = transaction.variableSymbol?.replace(/\s+/gu, "") ?? "";

  const candidates = input.payables.filter((payable) => {
    if (payable.cancelledAt) return false;
    if (payable.status !== "approved") return false;
    if (payable.currency !== transaction.currency) return false;
    if (decimalToMinor(payable.outstanding) <= BigInt(0)) return false;
    return true;
  });

  const vsHits = txVs
    ? candidates.filter((payable) => (payable.variableSymbol ?? "") === txVs)
    : [];
  const ambiguous = vsHits.length > 1;

  return candidates
    .map((payable) => {
      const reasons: PayableMatchReason[] = [];
      const blockers: PayableMatchBlocker[] = [];
      let score = 0;
      const outstanding = decimalToMinor(payable.outstanding);

      if (payingIban) {
        reasons.push("paying_account");
        score += 5;
      }
      reasons.push("currency");
      score += 5;

      const run = payable.submittedRunLine;
      if (
        run &&
        decimalToMinor(run.amount) === debitMinor &&
        (run.variableSymbol ?? "") === txVs &&
        (!run.beneficiaryIban ||
          normalizeAccount(run.beneficiaryIban) === txIban)
      ) {
        reasons.push("payment_run_line");
        score += 70;
      }

      if (txVs && (payable.variableSymbol ?? "") === txVs) {
        reasons.push("exact_variable_symbol");
        score += 50;
        if (ambiguous) blockers.push("ambiguous_variable_symbol");
      }

      const known = (payable.knownSupplierAccounts ?? [])
        .map((account) => normalizeAccount(account))
        .filter(Boolean);
      if (txIban && known.includes(txIban)) {
        reasons.push("known_supplier_account");
        score += 30;
      }

      if (debitMinor === outstanding) {
        reasons.push("exact_outstanding_amount");
        score += 25;
      } else if (debitMinor < outstanding) {
        reasons.push("partial_amount");
        score += 15;
      } else {
        reasons.push("overpayment");
        score += 10;
      }

      if (payable.dueDate || payable.issueDate) {
        const anchor = payable.dueDate ?? payable.issueDate!;
        const booked = transaction.bookingDate;
        const from = new Date(`${anchor}T00:00:00.000Z`);
        from.setUTCDate(from.getUTCDate() - 14);
        const to = new Date(`${anchor}T00:00:00.000Z`);
        to.setUTCDate(to.getUTCDate() + 30);
        if (
          booked >= from.toISOString().slice(0, 10) &&
          booked <= to.toISOString().slice(0, 10)
        ) {
          reasons.push("plausible_date");
          score += 5;
        }
      }

      const proposed = debitMinor < outstanding ? debitMinor : outstanding;
      const confidence: PayableMatchProposal["confidence"] =
        score >= 90 && blockers.length === 0
          ? "high"
          : score >= 50
            ? "medium"
            : "low";

      return {
        incomingInvoiceId: payable.id,
        proposedAmount: minorToDecimal(proposed),
        currency: payable.currency,
        score: Math.min(100, score),
        confidence,
        reasons,
        blockers,
      };
    })
    .sort((a, b) => b.score - a.score);
}
