import { describe, expect, it } from "vitest";

import creditNoteFixture from "../__fixtures__/invoices/credit-note.json";
import domesticFixture from "../__fixtures__/invoices/domestic-transfer.json";
import neplatceFixture from "../__fixtures__/invoices/neplatce-regular.json";
import proformaFixture from "../__fixtures__/invoices/proforma.json";
import reverseFixture from "../__fixtures__/invoices/reverse-charge.json";
import { detectInvoiceOrigin } from "../import/origin";
import { renderInvoicePdf } from "../pdf";
import { InvoiceSchema, type Invoice } from "../schema";
import { extractIsdocFromPdf } from "./extract-isdoc-from-pdf";
import { parseIsdoc } from "./parse-isdoc";
import { renderIsdoc } from "./render-isdoc";

function parseInvoice(raw: unknown): Invoice {
  const r = InvoiceSchema.safeParse(raw);
  if (!r.success) {
    expect.fail(JSON.stringify(r.error.flatten()));
  }
  return r.data;
}

const fixtures = [
  ["domestic", domesticFixture],
  ["neplatce", neplatceFixture],
  ["reverse", reverseFixture],
  ["credit", creditNoteFixture],
  ["proforma", proformaFixture],
] as const;

describe("parseIsdoc round-trip", () => {
  it.each(fixtures)(
    "render → parse preserves key fields (%s)",
    (_label, fixture) => {
      const original = parseInvoice(fixture);
      const xml = renderIsdoc(original);
      const { invoice } = parseIsdoc(xml, { issuer: original.issuer });

      expect(invoice.meta.number).toBe(original.meta.number);
      expect(invoice.meta.docType).toBe(original.meta.docType);
      expect(invoice.meta.issueDate).toBe(original.meta.issueDate);
      expect(invoice.meta.dueDate).toBe(original.meta.dueDate);
      expect(invoice.client.name).toBe(original.client.name);
      expect(invoice.client.ico).toBe(original.client.ico);
      expect(invoice.items.length).toBe(original.items.length);
      expect(invoice.totals.total).toBeCloseTo(original.totals.total, 2);
      expect(invoice.totals.subtotal).toBeCloseTo(original.totals.subtotal, 2);
      expect(invoice.issuer.id).toBe(original.issuer.id);
    },
  );
});

describe("extractIsdocFromPdf", () => {
  it("reads embedded invoice.isdoc from rendered PDF", async () => {
    const original = parseInvoice(domesticFixture);
    const pdf = await renderInvoicePdf(original);
    const xml = await extractIsdocFromPdf(pdf);
    expect(xml).toBeTruthy();
    expect(xml!).toContain("http://isdoc.cz/namespace/2013");
    const { invoice } = parseIsdoc(xml!, { issuer: original.issuer });
    expect(invoice.meta.number).toBe(original.meta.number);
  });

  it("returns null when PDF has no attachment", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const blank = await PDFDocument.create();
    blank.addPage();
    const bytes = await blank.save();
    expect(await extractIsdocFromPdf(bytes)).toBeNull();
  });
});

describe("detectInvoiceOrigin", () => {
  it("detects invoicey and fakturaonline", () => {
    expect(detectInvoiceOrigin({ producer: "Invoicey@0.4.0" }).provider).toBe(
      "invoicey",
    );
    expect(
      detectInvoiceOrigin({ softwareName: "FakturaOnline.cz" }).provider,
    ).toBe("fakturaonline");
    expect(detectInvoiceOrigin({ producer: "Unknown Tool" }).provider).toBe(
      "custom",
    );
  });
});
