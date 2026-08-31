import { describe, expect, it } from "vitest";

import creditNoteFixture from "../__fixtures__/invoices/credit-note.json";
import domesticEnFixture from "../__fixtures__/invoices/domestic-transfer-en.json";
import domesticFixture from "../__fixtures__/invoices/domestic-transfer.json";
import neplatceFixture from "../__fixtures__/invoices/neplatce-regular.json";
import reverseFixture from "../__fixtures__/invoices/reverse-charge.json";
import { invoiceLabels } from "../labels";
import { InvoiceSchema, type Invoice } from "../schema";
import {
  invoicePdfDocKindSubtitle,
  invoicePdfMainTitle,
  invoicePdfShowsVatColumn,
  invoicePdfTaxPointLabel,
} from "./pdf-presentation";

function parseInvoice(raw: unknown): Invoice {
  const parsed = InvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    expect.fail("fixture must satisfy InvoiceSchema");
  }
  return parsed.data;
}

describe("invoicePdfDocKindSubtitle", () => {
  it("omits the tax-document line on a non–VAT-payer invoice", () => {
    const invoice = parseInvoice(neplatceFixture);
    const labels = invoiceLabels(invoice.meta.language);
    expect(invoicePdfDocKindSubtitle(invoice, labels)).toBeNull();
  });

  it("keeps DAŇOVÝ DOKLAD on a VAT-payer invoice", () => {
    const invoice = parseInvoice(domesticFixture);
    const labels = invoiceLabels(invoice.meta.language);
    expect(invoicePdfDocKindSubtitle(invoice, labels)).toBe("DAŇOVÝ DOKLAD");
  });

  it("keeps DOBROPIS on a credit note", () => {
    const invoice = parseInvoice(creditNoteFixture);
    const labels = invoiceLabels(invoice.meta.language);
    expect(invoicePdfDocKindSubtitle(invoice, labels)).toBe("DOBROPIS");
  });
});

describe("invoicePdfShowsVatColumn", () => {
  it("hides the DPH column for a non–VAT-payer", () => {
    expect(invoicePdfShowsVatColumn(parseInvoice(neplatceFixture))).toBe(false);
  });

  it("shows the DPH column for a regular VAT-payer", () => {
    expect(invoicePdfShowsVatColumn(parseInvoice(domesticFixture))).toBe(true);
  });

  it("shows the DPH column for reverse charge", () => {
    expect(invoicePdfShowsVatColumn(parseInvoice(reverseFixture))).toBe(true);
  });
});

describe("invoicePdfTaxPointLabel", () => {
  it("uses the supply-date wording for a non–VAT-payer", () => {
    const invoice = parseInvoice(neplatceFixture);
    const labels = invoiceLabels(invoice.meta.language);
    expect(invoicePdfTaxPointLabel(invoice, labels)).toBe(
      "Datum uskutečnění plnění",
    );
  });

  it("keeps the tax-point wording for a VAT-payer", () => {
    const invoice = parseInvoice(domesticFixture);
    const labels = invoiceLabels(invoice.meta.language);
    expect(invoicePdfTaxPointLabel(invoice, labels)).toBe("Datum zdan. plnění");
  });
});

describe("invoicePdfMainTitle", () => {
  it("uses č. between the document kind and number in Czech", () => {
    const invoice = parseInvoice(neplatceFixture);
    const labels = invoiceLabels(invoice.meta.language);
    expect(invoicePdfMainTitle(invoice, labels)).toBe(
      `Faktura č. ${invoice.meta.number}`,
    );
  });

  it("uses No. between the document kind and number in English", () => {
    const invoice = parseInvoice(domesticEnFixture);
    const labels = invoiceLabels(invoice.meta.language);
    expect(invoicePdfMainTitle(invoice, labels)).toBe(
      `Invoice No. ${invoice.meta.number}`,
    );
  });
});
