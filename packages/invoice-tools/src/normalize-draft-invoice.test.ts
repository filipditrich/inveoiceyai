import { describe, expect, it } from "vitest";

import { getDemoIssuer } from "./demo-issuer";
import {
  addCalendarDaysYmd,
  normalizeDraftToInvoice,
  todayPragueYmd,
} from "./normalize-draft-invoice";

describe("normalizeDraftToInvoice", () => {
  it("builds a valid invoice from a minimal draft", () => {
    const issuer = getDemoIssuer();
    const draft = {
      meta: { docType: "invoice" as const },
      client: {
        id: "f6666666-6666-6666-6666-666666666666",
        name: "Test s.r.o.",
        ico: "44444444",
        address: {
          street: "Nákupní 1",
          city: "Ostrava",
          zip: "709 00",
          country: "CZ",
        },
      },
      vat: { mode: "regular" as const, suppliesAbroad: "none" as const },
      payment: { method: "transfer" as const, variableSymbol: "123456" },
      items: [
        {
          position: 1,
          description: "Konzultace",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 10_000,
          vatRate: 21,
        },
      ],
    };

    const r = normalizeDraftToInvoice(draft, issuer);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.invoice.issuer.id).toBe(issuer.id);
      expect(r.invoice.totals.total).toBeCloseTo(12_100, 5);
    }
  });

  it("assigns line position when omitted", () => {
    const issuer = getDemoIssuer();
    const draft = {
      meta: { docType: "invoice" as const },
      client: {
        name: "Test s.r.o.",
        ico: "44444444",
        address: {
          street: "Nákupní 1",
          city: "Ostrava",
          zip: "709 00",
          country: "CZ",
        },
      },
      vat: { mode: "regular" as const, suppliesAbroad: "none" as const },
      payment: { method: "transfer" as const, variableSymbol: "1" },
      items: [
        {
          description: "Konzultace",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 10_000,
          vatRate: 21,
        },
      ],
    };

    const r = normalizeDraftToInvoice(draft, issuer);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.invoice.items[0]?.position).toBe(1);
    }
  });

  it("infers vat from vatPreset when vat is missing", () => {
    const issuer = getDemoIssuer();
    const draft = {
      meta: { docType: "invoice" as const },
      client: {
        name: "Test s.r.o.",
        ico: "44444444",
        address: {
          street: "Nákupní 1",
          city: "Ostrava",
          zip: "709 00",
          country: "CZ",
        },
      },
      vatPreset: "regular" as const,
      payment: { method: "transfer" as const, variableSymbol: "1" },
      items: [
        {
          position: 1,
          description: "Konzultace",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 10_000,
          vatRate: 21,
        },
      ],
    };

    const r = normalizeDraftToInvoice(draft, issuer);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.invoice.vat.mode).toBe("regular");
      expect(r.invoice.vat.suppliesAbroad).toBe("none");
    }
  });

  it("converts inclusive unit prices when pricesIncludeVat is true", () => {
    const issuer = getDemoIssuer();
    const draft = {
      meta: { docType: "invoice" as const },
      client: {
        name: "Test s.r.o.",
        ico: "44444444",
        address: {
          street: "Nákupní 1",
          city: "Ostrava",
          zip: "709 00",
          country: "CZ",
        },
      },
      vat: { mode: "regular" as const, suppliesAbroad: "none" as const },
      pricesIncludeVat: true,
      payment: { method: "transfer" as const, variableSymbol: "1" },
      items: [
        {
          position: 1,
          description: "Konzultace",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 12_100,
          vatRate: 21,
        },
      ],
    };

    const r = normalizeDraftToInvoice(draft, issuer);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.invoice.items[0]?.unitPriceWithoutVat).toBe(10_000);
      expect(r.invoice.totals.subtotal).toBe(10_000);
      expect(r.invoice.totals.total).toBeCloseTo(12_100, 5);
    }
  });

  it("fails closed when reverse_charge lacks localReverseChargeCode", () => {
    const issuer = getDemoIssuer();
    const draft = {
      meta: { docType: "invoice" as const },
      client: {
        name: "Test s.r.o.",
        ico: "44444444",
        dic: "CZ44444444",
        address: {
          street: "Nákupní 1",
          city: "Ostrava",
          zip: "709 00",
          country: "CZ",
        },
      },
      vatPreset: "reverse_charge" as const,
      payment: { method: "transfer" as const, variableSymbol: "1" },
      items: [
        {
          position: 1,
          description: "Stavba",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 100_000,
          vatRate: 21,
        },
      ],
    };

    const r = normalizeDraftToInvoice(draft, issuer);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(
        r.issues.some((i) => i.path.includes("localReverseChargeCode")),
      ).toBe(true);
    }
  });

  it("maps vatPreset oss to suppliesAbroad eu", () => {
    const issuer = getDemoIssuer();
    const draft = {
      meta: { docType: "invoice" as const },
      client: {
        name: "EU Client GmbH",
        ico: "44444444",
        address: {
          street: "Hauptstr. 1",
          city: "Berlin",
          zip: "10115",
          country: "DE",
        },
      },
      vatPreset: "oss" as const,
      payment: { method: "transfer" as const, variableSymbol: "1" },
      items: [
        {
          position: 1,
          description: "SaaS",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 10_000,
          vatRate: 19,
        },
      ],
    };

    const r = normalizeDraftToInvoice(draft, issuer);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.invoice.vat.mode).toBe("oss");
      expect(r.invoice.vat.suppliesAbroad).toBe("eu");
    }
  });

  it("coerces non–VAT-payer issuer to regular mode and zero rates", () => {
    const issuer = { ...getDemoIssuer(), vatPayer: false, dic: undefined };
    const draft = {
      meta: { docType: "invoice" as const },
      client: {
        name: "Test s.r.o.",
        ico: "44444444",
        address: {
          street: "Nákupní 1",
          city: "Ostrava",
          zip: "709 00",
          country: "CZ",
        },
      },
      vat: { mode: "regular" as const, suppliesAbroad: "none" as const },
      payment: { method: "transfer" as const, variableSymbol: "1" },
      items: [
        {
          position: 1,
          description: "Konzultace",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 10_000,
          vatRate: 21,
        },
      ],
    };

    const r = normalizeDraftToInvoice(draft, issuer);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.invoice.vat.mode).toBe("regular");
      expect(r.invoice.items[0]?.vatRate).toBe(0);
      expect(r.invoice.totals.vatTotal).toBe(0);
      expect(r.invoice.totals.total).toBe(10_000);
    }
  });

  it("coerces flat Czech address string and human country name", () => {
    const issuer = getDemoIssuer();
    const draft = {
      meta: { docType: "invoice" as const },
      client: {
        name: "NFCtron a.s.",
        ico: "07283539",
        address: "Opletalova 1410, Praha 1, 110 00",
      },
      vat: { mode: "regular" as const, suppliesAbroad: "none" as const },
      payment: { method: "transfer" as const, variableSymbol: "1" },
      items: [
        {
          position: 1,
          description: "Vývoj",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 40_000,
          vatRate: 0,
        },
      ],
    };

    const r = normalizeDraftToInvoice(draft, issuer);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.invoice.client.address).toEqual({
        street: "Opletalova 1410",
        city: "Praha 1",
        zip: "110 00",
        country: "CZ",
      });
    }

    const withCountryName = normalizeDraftToInvoice(
      {
        ...draft,
        client: {
          name: "NFCtron a.s.",
          ico: "07283539",
          address: {
            street: "Opletalova 1525/39",
            city: "Praha",
            zip: "110 00",
            country: "Česká republika",
          },
        },
      },
      issuer,
    );
    expect(withCountryName.ok).toBe(true);
    if (withCountryName.ok) {
      expect(withCountryName.invoice.client.address.country).toBe("CZ");
    }
  });
});

describe("normalizeDraftToInvoice assumptions", () => {
  const today = todayPragueYmd();
  const client = {
    name: "Test s.r.o.",
    ico: "44444444",
    dic: "CZ44444444",
    address: {
      street: "Nákupní 1",
      city: "Ostrava",
      zip: "709 00",
      country: "CZ",
    },
  };
  const items = [
    {
      position: 1,
      description: "Konzultace",
      quantity: 1,
      unit: "ks",
      unitPriceWithoutVat: 10_000,
      vatRate: 21,
    },
  ];

  it("reports every field it filled in for a bare draft", () => {
    const r = normalizeDraftToInvoice(
      {
        meta: {},
        client,
        vat: { mode: "regular", suppliesAbroad: "none" },
        payment: { method: "transfer" },
        items,
      },
      getDemoIssuer(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const byPath = Object.fromEntries(r.assumptions.map((a) => [a.path, a]));
    expect(Object.keys(byPath).sort()).toEqual([
      "meta.currency",
      "meta.docType",
      "meta.dueDate",
      "meta.duzp",
      "meta.issueDate",
      "meta.language",
      "pricesIncludeVat",
    ]);
    expect(byPath["meta.dueDate"]).toMatchObject({
      label: "Due date",
      value: r.invoice.meta.dueDate,
      reason: "issue date + 14 days",
    });
    expect(byPath["pricesIncludeVat"]).toMatchObject({
      value: "excluding VAT",
    });
  });

  it("stays silent about fields the caller supplied", () => {
    const r = normalizeDraftToInvoice(
      {
        meta: {
          docType: "invoice",
          issueDate: today,
          dueDate: addCalendarDaysYmd(today, 30),
          duzp: today,
          currency: "EUR",
          language: "en",
        },
        client,
        vat: { mode: "regular", suppliesAbroad: "none" },
        payment: { method: "transfer" },
        pricesIncludeVat: false,
        items,
      },
      getDemoIssuer(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.assumptions).toEqual([]);
  });

  it("does not claim a price basis when no VAT applies", () => {
    const r = normalizeDraftToInvoice(
      {
        meta: { docType: "invoice", currency: "CZK", language: "cs" },
        client,
        vat: {
          mode: "reverse_charge",
          suppliesAbroad: "eu",
          localReverseChargeCode: "1",
        },
        payment: { method: "transfer" },
        items,
      },
      getDemoIssuer(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.assumptions.map((a) => a.path)).not.toContain("pricesIncludeVat");
  });
});

describe("normalizeDraftToInvoice suspect dates", () => {
  const today = todayPragueYmd();
  const client = {
    name: "Test s.r.o.",
    ico: "44444444",
    dic: "CZ44444444",
    address: {
      street: "Nákupní 1",
      city: "Ostrava",
      zip: "709 00",
      country: "CZ",
    },
  };
  const items = [
    {
      position: 1,
      description: "Konzultace",
      quantity: 1,
      unit: "ks",
      unitPriceWithoutVat: 10_000,
      vatRate: 21,
    },
  ];

  function normalizeWithIssueDate(issueDate: string) {
    return normalizeDraftToInvoice(
      {
        meta: {
          docType: "invoice",
          issueDate,
          currency: "CZK",
          language: "en",
        },
        client,
        vat: { mode: "regular", suppliesAbroad: "none" },
        payment: { method: "transfer" },
        pricesIncludeVat: false,
        items,
      },
      getDemoIssuer(),
    );
  }

  it("flags a supplied issue date that is nowhere near today", () => {
    const r = normalizeWithIssueDate("2023-10-09");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const suspect = r.assumptions.find((a) => a.kind === "suspect");
    expect(suspect).toMatchObject({
      path: "meta.issueDate",
      label: "Issue date",
      value: "2023-10-09",
      severity: "notable",
    });
    expect(suspect?.reason).toContain("days from today");
  });

  it("leaves a plausible back-date alone", () => {
    const r = normalizeWithIssueDate(addCalendarDaysYmd(today, -10));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.assumptions.some((a) => a.kind === "suspect")).toBe(false);
  });

  it("does not flag a date it defaulted itself", () => {
    const r = normalizeDraftToInvoice(
      {
        meta: { docType: "invoice", currency: "CZK", language: "en" },
        client,
        vat: { mode: "regular", suppliesAbroad: "none" },
        payment: { method: "transfer" },
        pricesIncludeVat: false,
        items,
      },
      getDemoIssuer(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.assumptions.every((a) => a.kind === "default")).toBe(true);
  });
});
