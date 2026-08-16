const PAYMENT_STATES = ["unpaid", "partial", "paid", "overpaid"] as const;

export type IncomingPaymentStateMessageKey =
  `payment.${(typeof PAYMENT_STATES)[number]}`;

export function incomingPaymentStateMessageKey(
  state: string,
): IncomingPaymentStateMessageKey {
  return (
    PAYMENT_STATES.includes(state as (typeof PAYMENT_STATES)[number])
      ? `payment.${state}`
      : "payment.unpaid"
  ) as IncomingPaymentStateMessageKey;
}
