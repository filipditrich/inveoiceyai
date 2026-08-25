import { describe, expect, it } from "vitest";

import { isIncomingInvoicePaymentRunEligible } from "./eligibility";

const base = {
  status: "approved",
  holdUntil: null,
  paymentState: "unpaid",
  outstanding: "100",
  currency: "CZK",
  runCurrency: "CZK",
  paymentMethod: "transfer",
  beneficiaryConfirmed: true,
  hasBeneficiary: true,
  iban: "CZ6508000000192000145399",
  accountNumber: null,
  bankCode: null,
  activePaymentRunId: null,
  docType: "invoice",
};

describe("incoming payment-run eligibility", () => {
  it("keeps an approved unpaid invoice eligible", () => {
    expect(isIncomingInvoicePaymentRunEligible(base)).toBe(true);
  });

  it.each([
    ["paid", { paymentState: "paid" }],
    ["overpaid", { paymentState: "overpaid" }],
    ["credit note", { docType: "credit_note" }],
    ["held", { holdUntil: "2999-01-01" }],
    ["missing beneficiary", { hasBeneficiary: false }],
    ["unconfirmed beneficiary", { beneficiaryConfirmed: false }],
    ["non-transfer method", { paymentMethod: "cash" }],
    ["foreign rail", { iban: "GB29NWBK60161331926819" }],
    ["currency mismatch", { runCurrency: "EUR" }],
    ["no outstanding balance", { outstanding: "0" }],
  ])("excludes %s documents", (_, changes) => {
    expect(isIncomingInvoicePaymentRunEligible({ ...base, ...changes })).toBe(
      false,
    );
  });
});
