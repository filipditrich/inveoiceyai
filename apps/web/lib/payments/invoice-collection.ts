import { decimalToMinor, minorToDecimal } from "@invoicey/payment-core";

export type CollectionPaymentState = "unpaid" | "partial" | "paid" | "overpaid";

export type CollectionProgress = {
  paidAmount: string;
  outstandingAmount: string;
  settled: boolean;
};

/** Exact, decimal-safe progress for the invoice collection screen and API. */
export function resolveCollectionProgress(
  total: string,
  paidAmount: string,
  paymentState: CollectionPaymentState,
): CollectionProgress {
  const totalMinor = decimalToMinor(total);
  const paidMinor = decimalToMinor(paidAmount);
  const zero = BigInt(0);
  const outstandingMinor =
    totalMinor > paidMinor ? totalMinor - paidMinor : zero;

  const hasPayment = paidMinor > zero;
  return {
    paidAmount: minorToDecimal(paidMinor),
    outstandingAmount: minorToDecimal(outstandingMinor),
    settled:
      hasPayment &&
      (paymentState === "paid" ||
        paymentState === "overpaid" ||
        outstandingMinor === zero),
  };
}
