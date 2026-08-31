import type { InvoiceLabels } from "../labels";
import type { Invoice } from "../schema";

function docKindLabel(invoice: Invoice, labels: InvoiceLabels): string {
  switch (invoice.meta.docType) {
    case "invoice":
      return labels.docKindInvoice;
    case "credit_note":
      return labels.docKindCreditNote;
    case "proforma":
      return labels.docKindProforma;
    case "advance":
      return labels.docKindAdvance;
    default: {
      const _never: never = invoice.meta.docType;
      return _never;
    }
  }
}

/**
 * Micro-line under the title. Non–VAT-payer invoices are not tax documents, so
 * the "DAŇOVÝ DOKLAD" / "TAX DOCUMENT" subtitle is omitted.
 */
export function invoicePdfDocKindSubtitle(
  invoice: Invoice,
  labels: InvoiceLabels,
): string | null {
  if (invoice.meta.docType === "invoice" && !invoice.issuer.vatPayer) {
    return null;
  }
  return docKindLabel(invoice, labels);
}

/** Line-item DPH % column — only for VAT-payer issuers (including reverse charge). */
export function invoicePdfShowsVatColumn(invoice: Invoice): boolean {
  return invoice.issuer.vatPayer;
}

/**
 * Performance-date label. VAT payers keep the tax-point wording; non-payers
 * get a supply date that does not imply a taxable supply.
 */
export function invoicePdfTaxPointLabel(
  invoice: Invoice,
  labels: InvoiceLabels,
): string {
  return invoice.issuer.vatPayer
    ? labels.taxPointDate
    : labels.taxPointDateNonVat;
}

function invoicePdfDocTitle(invoice: Invoice, labels: InvoiceLabels): string {
  switch (invoice.meta.docType) {
    case "invoice":
      return labels.titleInvoice;
    case "credit_note":
      return labels.titleCreditNote;
    case "proforma":
      return labels.titleProforma;
    case "advance":
      return labels.titleAdvance;
    default: {
      const _never: never = invoice.meta.docType;
      return _never;
    }
  }
}

/** Visible PDF title, e.g. `Faktura č. 20260119` / `Invoice No. 20260119`. */
export function invoicePdfMainTitle(
  invoice: Invoice,
  labels: InvoiceLabels,
): string {
  return `${invoicePdfDocTitle(invoice, labels)} ${labels.docNo} ${invoice.meta.number}`;
}
