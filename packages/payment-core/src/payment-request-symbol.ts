import { randomInt } from "node:crypto";

const SYMBOL_DIGITS = 9;
const DEFAULT_MAX_ATTEMPTS = 16;

function defaultNineRandomDigits(): string {
  return randomInt(0, 1_000_000_000).toString().padStart(SYMBOL_DIGITS, "0");
}

/** `9` + 9 random digits. The prefix is a convention, not a uniqueness guarantee. */
export function generatePaymentRequestSymbol(
  randomDigits: () => string = defaultNineRandomDigits,
): string {
  const digits = randomDigits();
  if (!/^\d{9}$/u.test(digits)) {
    throw new Error("payment_request_symbol_entropy");
  }
  return `9${digits}`;
}

/**
 * Picks a request symbol that is free on the receiving account.
 *
 * `isTaken` must check open and cancelled requests *and* invoice symbols on
 * that account. A collision is retried; exhausting attempts fails closed.
 */
export async function allocatePaymentRequestSymbol(input: {
  isTaken: (symbol: string) => boolean | Promise<boolean>;
  randomDigits?: () => string;
  maxAttempts?: number;
}): Promise<string> {
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const symbol = generatePaymentRequestSymbol(input.randomDigits);
    if (!(await input.isTaken(symbol))) return symbol;
  }
  throw new Error("payment_request_symbol_exhausted");
}
