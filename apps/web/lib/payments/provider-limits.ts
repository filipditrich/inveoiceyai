import type { BankProvider } from "@invoicey/payment-core";

/**
 * Shortest gap allowed between two requests on one connection's credential.
 *
 * Fio documents one request per token per 30 seconds and answers `409` when you
 * are early; MONETA is an order of magnitude more permissive. A watch session
 * polls at this floor, so treating it as one shared constant would either waste
 * MONETA's headroom or get every Fio connection throttled.
 */
export const BANK_POLL_INTERVAL_MS = {
  /** Fio's documented 30s plus a second of clock-skew headroom. */
  fio: 31_000,
  moneta: 5_000,
} satisfies Record<BankProvider, number>;

/** Milliseconds until this connection may call its provider again. */
export function millisecondsUntilPollAllowed(input: {
  provider: BankProvider;
  lastRequestAt: Date | null;
  now: Date;
}): number {
  if (!input.lastRequestAt) return 0;
  const elapsed = input.now.getTime() - input.lastRequestAt.getTime();
  const remaining = BANK_POLL_INTERVAL_MS[input.provider] - elapsed;
  return remaining > 0 ? remaining : 0;
}
