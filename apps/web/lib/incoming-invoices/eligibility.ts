import { classifyFioRail } from "@invoicey/payment-core";

export type PayableEligibilityReason =
  | "not_approved"
  | "on_hold"
  | "nothing_to_pay"
  | "currency_mismatch"
  | "not_transfer"
  | "unconfirmed_beneficiary"
  | "foreign_rail"
  | "already_in_run"
  | "credit_note";

export function payableEligibility(input: {
  status: string;
  holdUntil?: string | null;
  paymentState: string;
  outstanding: string;
  currency: string;
  runCurrency: string;
  paymentMethod: string;
  beneficiaryConfirmed: boolean;
  hasBeneficiary: boolean;
  iban?: string | null;
  accountNumber?: string | null;
  bankCode?: string | null;
  activePaymentRunId?: string | null;
  docType: string;
}): PayableEligibilityReason[] {
  const reasons: PayableEligibilityReason[] = [];
  if (input.status !== "approved") reasons.push("not_approved");
  const today = new Date().toISOString().slice(0, 10);
  if (input.holdUntil && input.holdUntil >= today) reasons.push("on_hold");
  if (input.paymentState === "paid" || Number(input.outstanding) <= 0) {
    reasons.push("nothing_to_pay");
  }
  if (input.currency !== input.runCurrency) reasons.push("currency_mismatch");
  if (input.paymentMethod !== "transfer") reasons.push("not_transfer");
  if (!input.hasBeneficiary || !input.beneficiaryConfirmed) {
    reasons.push("unconfirmed_beneficiary");
  }
  const rail = classifyFioRail({
    iban: input.iban,
    accountNumber: input.accountNumber,
    bankCode: input.bankCode,
  });
  if (rail === "foreign") reasons.push("foreign_rail");
  if (input.activePaymentRunId) reasons.push("already_in_run");
  if (input.docType === "credit_note") reasons.push("credit_note");
  return reasons;
}
