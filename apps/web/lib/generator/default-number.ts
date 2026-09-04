import { DEFAULT_TEMPLATES } from "@/lib/issuer-types";

import { nextInvoiceNumber } from "@invoicey/invoice-core/numbering";

/**
 * Prefill the guest invoice number from the same defaults a new issuer gets
 * (`DEFAULT_TEMPLATES.invoice`). Uniqueness is workspace-scoped (ADR 0048 §3).
 */
export function defaultGuestInvoiceNumber(
  issuerName: string,
  issueDate: Date,
): string {
  return nextInvoiceNumber(
    {
      template: DEFAULT_TEMPLATES.invoice,
      counter: 0,
      counterYear: issueDate.getFullYear(),
      resetPeriod: "yearly",
      padding: 4,
      docType: "invoice",
      issuerName,
    },
    issueDate,
  );
}
