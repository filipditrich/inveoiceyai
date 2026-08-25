const ORDERED_FACTORS = [
  "exact_variable_symbol",
  "exact_outstanding_amount",
  "receiving_account",
  "known_client_account",
  "plausible_date",
  "currency",
  "partial_amount",
  "overpayment",
] as const;

/** Stable display order; this does not change the matching score or proposal. */
export function paymentMatchFactors(reasonCodes: readonly string[]): string[] {
  const reasons = new Set(reasonCodes);
  return ORDERED_FACTORS.filter((factor) => reasons.has(factor));
}
