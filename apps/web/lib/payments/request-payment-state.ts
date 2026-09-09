import { decimalToMinor } from "@invoicey/payment-core";

import type { CollectionPaymentState } from "./invoice-collection";

/** Derive request progress from allocated money. Status alone is not enough. */
export function requestPaymentState(
  status: string,
  requested: string,
  allocated: string,
): CollectionPaymentState {
  const allocatedMinor = decimalToMinor(allocated);
  const requestedMinor = decimalToMinor(requested);
  if (allocatedMinor <= BigInt(0)) return "unpaid";
  if (allocatedMinor > requestedMinor) return "overpaid";
  if (allocatedMinor === requestedMinor || status === "settled") return "paid";
  return "partial";
}
