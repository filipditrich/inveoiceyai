import { buildSpaydPayloadFromFacts } from "@invoicey/invoice-core";

import { resolveCollectionProgress } from "./invoice-collection";
import type { CollectionPaymentState } from "./invoice-collection";
import { requestPaymentState } from "./request-payment-state";

export type PublicPaymentRequestView = {
  issuerName: string;
  title: string;
  currency: "CZK";
  accountNumber: string;
  iban: string;
  variableSymbol: string;
  requestedAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  settled: boolean;
  paymentState: CollectionPaymentState;
  qrPayload: string | null;
  settledAt: Date | null;
};

/** Map a public-token row into the payer-facing page model. */
export function toPublicPaymentRequestView(input: {
  status: string;
  amount: string;
  allocatedAmount: string;
  message: string | null;
  variableSymbol: string;
  settledAt: Date | null;
  issuerName: string;
  accountNumber: string;
  iban: string;
  bic: string | null;
}): PublicPaymentRequestView | null {
  if (input.status === "cancelled") return null;

  const paymentState = requestPaymentState(
    input.status,
    input.amount,
    input.allocatedAmount,
  );
  const progress = resolveCollectionProgress(
    input.amount,
    input.allocatedAmount,
    paymentState,
  );

  let qrPayload: string | null = null;
  if (!progress.settled) {
    qrPayload = buildSpaydPayloadFromFacts({
      iban: input.iban,
      bic: input.bic,
      amount: Number(progress.outstandingAmount),
      currency: "CZK",
      beneficiaryName: input.issuerName,
      beneficiaryMessage: input.message,
      variableSymbol: input.variableSymbol,
    });
    if (!qrPayload) return null;
  }

  return {
    issuerName: input.issuerName,
    title: input.message?.trim() || "",
    currency: "CZK",
    accountNumber: input.accountNumber,
    iban: input.iban,
    variableSymbol: input.variableSymbol,
    requestedAmount: input.amount,
    paidAmount: progress.paidAmount,
    outstandingAmount: progress.outstandingAmount,
    settled: progress.settled,
    paymentState,
    qrPayload,
    settledAt: input.settledAt,
  };
}
