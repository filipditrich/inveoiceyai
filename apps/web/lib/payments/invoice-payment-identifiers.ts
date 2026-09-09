import type { Invoice } from "@invoicey/invoice-core/schema";

/** Digit-only variable symbol used by invoices and payment requests. */
export function normalizePaymentVariableSymbol(
  value: string | null | undefined,
): string | null {
  return value?.replace(/\D/gu, "") || null;
}

/** Denormalized immutable payment identifiers used by the bank matcher. */
export function invoicePaymentIdentifiers(payment: Invoice["payment"]): {
  paymentAccountIban: string | null;
  paymentVariableSymbol: string | null;
} {
  return {
    paymentAccountIban:
      payment.bankAccount?.iban.replace(/\s+/gu, "").toUpperCase() ?? null,
    paymentVariableSymbol: normalizePaymentVariableSymbol(
      payment.variableSymbol,
    ),
  };
}
