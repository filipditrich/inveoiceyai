import { describe, expect, it } from "vitest";

import offsetDepositFixture from "./__fixtures__/invoices/offset-deposit.json";
import {
  INVOICE_RENDER_BATCH_LIMIT,
  parseInvoiceRenderRequest,
  uniquePdfFileNames,
} from "./render-batch";
import { InvoiceSchema, type Invoice } from "./schema";

const issuer = {
  id: "ca8b8d4e-2e7e-4f6a-9b7d-1f9c1234abcd",
  name: "Acme Supplier s.r.o.",
  ico: "12345678",
  dic: "CZ12345678",
  address: {
    street: "Na Příkopě 14",
    city: "Praha",
    zip: "110 00",
    country: "CZ" as const,
  },
  bank: {
    accountNumber: "19-2000145399/0800",
    iban: "CZ6508000000192000145399",
    bic: "GIBACZPX",
  },
  vatPayer: true,
  contactEmail: "fakturace@acmesupplier.example",
};

function invoiceJson(number: string) {
  return {
    meta: {
      docType: "invoice",
      number,
      issueDate: "2026-05-03",
      dueDate: "2026-05-17",
      duzp: "2026-05-03",
      language: "cs",
      currency: "CZK",
    },
    issuer,
    client: {
      id: "5bc1d5a7-0c58-4cda-a1f6-4ad9876543ff",
      name: "NFCtron s.r.o.",
      ico: "87654321",
      address: {
        street: "Křížová 2598/4",
        city: "Brno",
        zip: "603 00",
        country: "CZ",
      },
    },
    vat: { mode: "regular", suppliesAbroad: "none" },
    payment: {
      method: "transfer",
      bankAccount: issuer.bank,
      variableSymbol: "20260001",
    },
    items: [
      {
        position: 1,
        description: "Work",
        quantity: 1,
        unit: "ks",
        unitPriceWithoutVat: 100,
        vatRate: 21,
        lineSubtotal: 100,
        lineVat: 21,
        lineTotal: 121,
      },
    ],
    totals: {
      subtotal: 100,
      vatBreakdown: [{ rate: 21, base: 100, vat: 21 }],
      vatTotal: 21,
      total: 121,
    },
  };
}

function parsedInvoice(number: string): Invoice {
  return InvoiceSchema.parse(invoiceJson(number));
}

describe("parseInvoiceRenderRequest", () => {
  it("accepts { invoices: [...] }", () => {
    const result = parseInvoiceRenderRequest({
      invoices: [invoiceJson("20260001"), invoiceJson("20260002")],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoices.map((row) => row.meta.number)).toEqual([
      "20260001",
      "20260002",
    ]);
  });

  it("accepts a bare array and a single invoice object", () => {
    const asArray = parseInvoiceRenderRequest([invoiceJson("20260001")]);
    expect(asArray.ok).toBe(true);

    const asOne = parseInvoiceRenderRequest(invoiceJson("20260001"));
    expect(asOne.ok).toBe(true);
    if (!asOne.ok) return;
    expect(asOne.invoices).toHaveLength(1);
  });

  it("rejects an empty list and a non-object body", () => {
    expect(parseInvoiceRenderRequest({ invoices: [] })).toEqual({
      ok: false,
      error: "empty",
    });
    expect(parseInvoiceRenderRequest("nope")).toEqual({
      ok: false,
      error: "invalid_shape",
    });
  });

  it("rejects a batch over the limit", () => {
    const invoices = Array.from(
      { length: INVOICE_RENDER_BATCH_LIMIT + 1 },
      () => invoiceJson("20260001"),
    );
    expect(parseInvoiceRenderRequest({ invoices })).toEqual({
      ok: false,
      error: "too_many",
      limit: INVOICE_RENDER_BATCH_LIMIT,
      count: INVOICE_RENDER_BATCH_LIMIT + 1,
    });
  });

  it("accepts an offset invoice with a záloha deduction", () => {
    const result = parseInvoiceRenderRequest({
      invoices: [offsetDepositFixture],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoices).toHaveLength(1);
    expect(result.invoices[0]?.payment.method).toBe("offset");
    expect(result.invoices[0]?.items[1]?.quantity).toBe(-1);
    expect(result.invoices[0]?.totals.total).toBe(0);
  });

  it("returns per-index validation issues without rendering", () => {
    const broken = { ...invoiceJson("20260002") };
    Reflect.deleteProperty(broken, "issuer");
    const result = parseInvoiceRenderRequest({
      invoices: [invoiceJson("20260001"), broken],
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error !== "validation_failed") {
      throw new Error("expected validation_failed");
    }
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.index).toBe(1);
    expect(result.issues[0]?.fieldErrors.issuer).toBeDefined();
  });
});

describe("uniquePdfFileNames", () => {
  it("uses the localized artifact name and disambiguates collisions", () => {
    const first = parsedInvoice("2026/001");
    const second = parsedInvoice("2026/001");
    expect(uniquePdfFileNames([first, second])).toEqual([
      "faktura_2026_001.pdf",
      "faktura_2026_001_2.pdf",
    ]);
  });
});
