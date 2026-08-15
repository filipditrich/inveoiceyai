import type { Invoice } from "@invoicey/invoice-core/schema";

/** Denormalized immutable payment identifiers used by the bank matcher. */
export function invoicePaymentIdentifiers(payment: Invoice["payment"]): {
  paymentAccountIban: string | null;
  paymentVariableSymbol: string | null;
} {
  return {
    paymentAccountIban:
      payment.bankAccount?.iban.replace(/\s+/gu, "").toUpperCase() ?? null,
    paymentVariableSymbol: payment.variableSymbol?.replace(/\D/gu, "") || null,
  };
}
