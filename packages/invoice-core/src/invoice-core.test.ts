import { describe, expect, it } from "vitest";

import {
  calcTotals,
  deriveStatus,
  exclusiveUnitPriceFromInclusive,
  normalizeDisplayStatusParam,
  pragueTodayIso,
  resolveDisplayStatus,
  slugifyIssuerName,
  nextInvoiceNumber,
  ClientSnapshotSchema,
  InvoiceItemSchema,
  InvoiceMetaSchema,
  InvoiceSchema,
  InvoiceVatSchema,
  IssuerSnapshotSchema,
  PaymentSchema,
  round2,
  TotalsSchema,
  type NumberingSchemeInput,
  endOfDueDateInPrague,
} from "./index";
import type { z } from "zod";

type InvoiceMeta = z.infer<typeof InvoiceMetaSchema>;
type Issuer = z.infer<typeof IssuerSnapshotSchema>;
type Client = z.infer<typeof ClientSnapshotSchema>;
type LineItem = z.infer<typeof InvoiceItemSchema>;
type Totals = z.infer<typeof TotalsSchema>;
type InvoiceVat = z.infer<typeof InvoiceVatSchema>;
type Payment = z.infer<typeof PaymentSchema>;

const issuerBase: Issuer = {
  id: "ca8b8d4e-2e7e-4f6a-9b7d-1f9c1234abcd",
  name: "Acme Supplier s.r.o.",
  ico: "12345678",
  dic: "CZ12345678",
  address: {
    street: "Na Příkopě 14",
    city: "Praha",
    zip: "110 00",
    country: "CZ",
  },
  bank: {
    accountNumber: "19-2000145399/0800",
    iban: "CZ6508000000192000145399",
    bic: "GIBACZPX",
  },
  vatPayer: true,
  contactEmail: "fakturace@acmesupplier.example",
};

const clientBase: Client = {
  id: "5bc1d5a7-0c58-4cda-a1f6-4ad9876543ff",
  name: "NFCtron s.r.o.",
  ico: "87654321",
  dic: "CZ87654321",
  address: {
    street: "Křížová 2598/4",
    city: "Brno",
    zip: "603 00",
    country: "CZ",
  },
};

const metaBase: InvoiceMeta = {
  docType: "invoice",
  number: "20260001",
  issueDate: "2026-05-03",
  dueDate: "2026-05-17",
  duzp: "2026-05-03",
  language: "cs",
  currency: "CZK",
};

const paymentBase: Payment = {
  method: "transfer",
  bankAccount: issuerBase.bank,
  variableSymbol: "20260001",
};

function buildInvoice(
  overrides: Partial<{
    meta: Partial<InvoiceMeta>;
    issuer: Partial<Issuer>;
    client: Partial<Client>;
    vat: InvoiceVat;
    items: LineItem[];
    totals: Totals;
  }> = {},
) {
  const vat: InvoiceVat = overrides.vat ?? {
    mode: "regular",
    suppliesAbroad: "none",
  };
  const items: LineItem[] = overrides.items ?? [
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
  ];
  const totals: Totals = overrides.totals ?? {
    subtotal: 100,
    vatBreakdown: [{ rate: 21, base: 100, vat: 21 }],
    vatTotal: 21,
    total: 121,
  };
  return InvoiceSchema.parse({
    meta: { ...metaBase, ...overrides.meta },
    issuer: { ...issuerBase, ...overrides.issuer },
    client: { ...clientBase, ...overrides.client },
    vat,
    payment: paymentBase,
    items,
    totals,
  });
}

describe("round2", () => {
  it("rounds to two decimals", () => {
    expect(round2(1.999)).toBe(2);
    expect(round2(1.001)).toBe(1);
    expect(round2(1.005)).toBe(Math.round(1.005 * 100) / 100);
  });
});

describe("exclusiveUnitPriceFromInclusive", () => {
  it("converts 21% inclusive to exclusive", () => {
    expect(exclusiveUnitPriceFromInclusive(12_100, 21)).toBe(10_000);
    expect(exclusiveUnitPriceFromInclusive(121, 21)).toBe(100);
  });

  it("converts 12% inclusive to exclusive", () => {
    expect(exclusiveUnitPriceFromInclusive(1_120, 12)).toBe(1_000);
  });

  it("leaves amount unchanged at rate 0", () => {
    expect(exclusiveUnitPriceFromInclusive(1_000.555, 0)).toBe(1_000.56);
  });
});

describe("calcTotals", () => {
  it("computes mixed VAT rates with bucket rounding", () => {
    const { items, totals } = calcTotals(
      [
        {
          position: 1,
          description: "A",
          quantity: 2,
          unit: "ks",
          unitPriceWithoutVat: 2000,
          vatRate: 12,
        },
        {
          position: 2,
          description: "B",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 5000,
          vatRate: 21,
        },
      ],
      { mode: "regular", suppliesAbroad: "none" },
      true,
    );
    expect(items[0]?.lineSubtotal).toBe(4000);
    expect(items[1]?.lineSubtotal).toBe(5000);
    expect(totals.subtotal).toBe(9000);
    expect(totals.vatBreakdown).toEqual(
      expect.arrayContaining([
        { rate: 12, base: 4000, vat: 480 },
        { rate: 21, base: 5000, vat: 1050 },
      ]),
    );
    expect(totals.vatTotal).toBe(1530);
    expect(totals.total).toBe(10530);
  });

  it("forces zero VAT for non–VAT-payer", () => {
    const { totals, items } = calcTotals(
      [
        {
          position: 1,
          description: "X",
          quantity: 10,
          unit: "h",
          unitPriceWithoutVat: 1000,
          vatRate: 21,
        },
      ],
      { mode: "regular", suppliesAbroad: "none" },
      false,
    );
    expect(items[0]?.vatRate).toBe(21);
    expect(items[0]?.lineVat).toBe(0);
    expect(totals.vatTotal).toBe(0);
    expect(totals.total).toBe(10000);
  });

  it("reverse_charge yields zero VAT lines", () => {
    const { items, totals } = calcTotals(
      [
        {
          position: 1,
          description: "RC",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 250000,
          vatRate: 0,
        },
      ],
      { mode: "reverse_charge", suppliesAbroad: "none" },
      true,
    );
    expect(items[0]?.lineVat).toBe(0);
    expect(totals.vatTotal).toBe(0);
    expect(totals.total).toBe(250000);
  });

  it("handles zero-amount line", () => {
    const { items, totals } = calcTotals(
      [
        {
          position: 1,
          description: "Free",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 0,
          vatRate: 21,
        },
      ],
      { mode: "regular", suppliesAbroad: "none" },
      true,
    );
    expect(items[0]?.lineSubtotal).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("credit-style negative quantity", () => {
    const { items, totals } = calcTotals(
      [
        {
          position: 1,
          description: "Storno",
          quantity: -8,
          unit: "h",
          unitPriceWithoutVat: 1500,
          vatRate: 21,
        },
      ],
      { mode: "regular", suppliesAbroad: "none" },
      true,
    );
    expect(items[0]?.lineSubtotal).toBe(-12000);
    expect(items[0]?.lineVat).toBe(-2520);
    expect(items[0]?.lineTotal).toBe(-14520);
    expect(totals.subtotal).toBe(-12000);
    expect(totals.vatTotal).toBe(-2520);
    expect(totals.total).toBe(-14520);
  });
});

describe("InvoiceSchema", () => {
  it("accepts domestic regular invoice", () => {
    expect(() => buildInvoice({})).not.toThrow();
  });

  it("defaults missing meta.language to cs", () => {
    const metaWithoutLanguage: Omit<InvoiceMeta, "language"> = {
      docType: metaBase.docType,
      number: metaBase.number,
      issueDate: metaBase.issueDate,
      dueDate: metaBase.dueDate,
      duzp: metaBase.duzp,
      currency: metaBase.currency,
    };
    const res = InvoiceSchema.safeParse({
      meta: metaWithoutLanguage,
      issuer: issuerBase,
      client: clientBase,
      vat: { mode: "regular", suppliesAbroad: "none" },
      payment: paymentBase,
      items: [
        {
          position: 1,
          description: "x",
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
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.meta.language).toBe("cs");
    }
  });

  it("rejects credit_note without correctedInvoiceNumber", () => {
    const res = InvoiceSchema.safeParse({
      meta: {
        ...metaBase,
        docType: "credit_note",
        number: "DOB1",
      },
      issuer: issuerBase,
      client: clientBase,
      vat: { mode: "regular", suppliesAbroad: "none" },
      payment: paymentBase,
      items: [
        {
          position: 1,
          description: "x",
          quantity: -1,
          unit: "ks",
          unitPriceWithoutVat: 10,
          vatRate: 21,
          lineSubtotal: -10,
          lineVat: -2.1,
          lineTotal: -12.1,
        },
      ],
      totals: {
        subtotal: -10,
        vatBreakdown: [{ rate: 21, base: -10, vat: -2.1 }],
        vatTotal: -2.1,
        total: -12.1,
      },
    });
    expect(res.success).toBe(false);
  });

  it("accepts credit note with negative totals", () => {
    const inv = buildInvoice({
      meta: {
        ...metaBase,
        docType: "credit_note",
        number: "DOB20260001",
        correctedInvoiceNumber: "20260001",
      },
      items: [
        {
          position: 1,
          description: "Storno",
          quantity: -8,
          unit: "h",
          unitPriceWithoutVat: 1500,
          vatRate: 21,
          lineSubtotal: -12000,
          lineVat: -2520,
          lineTotal: -14520,
        },
      ],
      totals: {
        subtotal: -12000,
        vatBreakdown: [{ rate: 21, base: -12000, vat: -2520 }],
        vatTotal: -2520,
        total: -14520,
      },
    });
    expect(inv.meta.docType).toBe("credit_note");
  });

  it("rejects oss with suppliesAbroad none", () => {
    const res = InvoiceSchema.safeParse({
      meta: metaBase,
      issuer: issuerBase,
      client: {
        ...clientBase,
        address: { ...clientBase.address, country: "DE" },
      },
      vat: { mode: "oss", suppliesAbroad: "none" },
      payment: paymentBase,
      items: [
        {
          position: 1,
          description: "x",
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
    });
    expect(res.success).toBe(false);
  });

  it("accepts oss with eu supplies and foreign client", () => {
    const inv = buildInvoice({
      vat: { mode: "oss", suppliesAbroad: "eu" },
      client: {
        ...clientBase,
        ico: undefined,
        dic: "DE123456789",
        address: {
          street: "Haupt",
          city: "Berlin",
          zip: "10115",
          country: "DE",
        },
      },
    });
    expect(inv.vat.mode).toBe("oss");
  });

  it("accepts regular non_eu export style with zero rate", () => {
    const inv = buildInvoice({
      vat: { mode: "regular", suppliesAbroad: "non_eu" },
      client: {
        ...clientBase,
        ico: undefined,
        address: { street: "x", city: "y", zip: "12345", country: "US" },
      },
      items: [
        {
          position: 1,
          description: "export",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 1000,
          vatRate: 0,
          lineSubtotal: 1000,
          lineVat: 0,
          lineTotal: 1000,
        },
      ],
      totals: {
        subtotal: 1000,
        vatBreakdown: [{ rate: 0, base: 1000, vat: 0 }],
        vatTotal: 0,
        total: 1000,
      },
    });
    expect(inv.vat.suppliesAbroad).toBe("non_eu");
  });

  it("rejects reverse_charge with non-zero line VAT", () => {
    const res = InvoiceSchema.safeParse({
      meta: metaBase,
      issuer: issuerBase,
      client: { ...clientBase, dic: "DE123456789" },
      vat: {
        mode: "reverse_charge",
        suppliesAbroad: "eu",
        localReverseChargeCode: "4",
      },
      payment: paymentBase,
      items: [
        {
          position: 1,
          description: "x",
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
    });
    expect(res.success).toBe(false);
  });

  it("rejects reverse_charge without localReverseChargeCode", () => {
    const res = InvoiceSchema.safeParse({
      meta: metaBase,
      issuer: issuerBase,
      client: { ...clientBase, dic: "CZ07654321" },
      vat: { mode: "reverse_charge", suppliesAbroad: "none" },
      payment: paymentBase,
      items: [
        {
          position: 1,
          description: "RC",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 1000,
          vatRate: 0,
          lineSubtotal: 1000,
          lineVat: 0,
          lineTotal: 1000,
        },
      ],
      totals: {
        subtotal: 1000,
        vatBreakdown: [{ rate: 0, base: 1000, vat: 0 }],
        vatTotal: 0,
        total: 1000,
      },
    });
    expect(res.success).toBe(false);
  });

  it("accepts reverse_charge with localReverseChargeCode", () => {
    const inv = buildInvoice({
      vat: {
        mode: "reverse_charge",
        suppliesAbroad: "none",
        localReverseChargeCode: "4",
        legalNote: "Daň odvede zákazník dle § 92e zákona č. 235/2004 Sb.",
      },
      client: { ...clientBase, dic: "CZ07654321" },
      items: [
        {
          position: 1,
          description: "Stavební práce",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 1000,
          vatRate: 0,
          lineSubtotal: 1000,
          lineVat: 0,
          lineTotal: 1000,
        },
      ],
      totals: {
        subtotal: 1000,
        vatBreakdown: [{ rate: 0, base: 1000, vat: 0 }],
        vatTotal: 0,
        total: 1000,
      },
    });
    expect(inv.vat.localReverseChargeCode).toBe("4");
  });

  it("rejects non–VAT-payer with nonzero vatRate", () => {
    const res = InvoiceSchema.safeParse({
      meta: metaBase,
      issuer: { ...issuerBase, vatPayer: false, dic: undefined },
      client: clientBase,
      vat: { mode: "regular", suppliesAbroad: "none" },
      payment: paymentBase,
      items: [
        {
          position: 1,
          description: "x",
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
    });
    expect(res.success).toBe(false);
  });

  it("transfer without bankAccount fails", () => {
    const res = InvoiceSchema.safeParse({
      meta: metaBase,
      issuer: issuerBase,
      client: clientBase,
      vat: { mode: "regular", suppliesAbroad: "none" },
      payment: { method: "transfer" },
      items: [
        {
          position: 1,
          description: "x",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 1,
          vatRate: 0,
          lineSubtotal: 1,
          lineVat: 0,
          lineTotal: 1,
        },
      ],
      totals: {
        subtotal: 1,
        vatBreakdown: [{ rate: 0, base: 1, vat: 0 }],
        vatTotal: 0,
        total: 1,
      },
    });
    expect(res.success).toBe(false);
  });
});

describe("nextInvoiceNumber", () => {
  const baseScheme: NumberingSchemeInput = {
    template: "{YYYY}{####}",
    counter: 6,
    resetPeriod: "never",
    padding: 4,
    docType: "invoice",
    issuerName: "NFCtron s.r.o.",
  };

  it("pads counter from template hash width", () => {
    expect(nextInvoiceNumber(baseScheme, new Date(Date.UTC(2026, 4, 3)))).toBe(
      "20260007",
    );
  });

  it("yearly reset when issue year differs from counterYear", () => {
    expect(
      nextInvoiceNumber(
        {
          ...baseScheme,
          template: "{YYYY}-{####}",
          counter: 99,
          counterYear: 2025,
          resetPeriod: "yearly",
        },
        new Date(Date.UTC(2026, 0, 1)),
      ),
    ).toBe("2026-0001");
  });

  it("substitutes all tokens", () => {
    const s: NumberingSchemeInput = {
      ...baseScheme,
      template: "{TYPE}-{YY}-{MM}-{DD}-{ISSUER}-{###}",
      counter: 0,
    };
    const n = nextInvoiceNumber(s, new Date(Date.UTC(2026, 4, 3)));
    expect(n).toBe("FV-26-05-03-nfctron-001");
  });

  it("slugifyIssuerName uses first word and truncates to 12 chars", () => {
    expect(slugifyIssuerName("Verylongcompanyname Here")).toBe("verylongcomp");
  });
});

describe("deriveStatus", () => {
  const due = new Date(Date.UTC(2026, 4, 17));

  it("draft when not issued", () => {
    expect(
      deriveStatus(
        {
          issuedAt: null,
          dueDate: due,
          paidAt: null,
          cancelledAt: null,
        },
        new Date(),
      ),
    ).toBe("draft");
  });

  it("paid wins over overdue", () => {
    expect(
      deriveStatus(
        {
          issuedAt: new Date(),
          dueDate: due,
          paidAt: new Date(),
          cancelledAt: null,
        },
        new Date(Date.UTC(2099, 0, 1)),
      ),
    ).toBe("paid");
  });

  it("cancelled wins over paid in facts order", () => {
    expect(
      deriveStatus(
        {
          issuedAt: new Date(),
          dueDate: due,
          paidAt: new Date(),
          cancelledAt: new Date(),
        },
        new Date(),
      ),
    ).toBe("cancelled");
  });

  it("issued before Prague end of due day", () => {
    const end = endOfDueDateInPrague(due);
    expect(
      deriveStatus(
        {
          issuedAt: new Date(),
          dueDate: due,
          paidAt: null,
          cancelledAt: null,
        },
        new Date(end.getTime() - 1),
      ),
    ).toBe("issued");
  });

  it("overdue after Prague end of due day", () => {
    const end = endOfDueDateInPrague(due);
    expect(
      deriveStatus(
        {
          issuedAt: new Date(),
          dueDate: due,
          paidAt: null,
          cancelledAt: null,
        },
        new Date(end.getTime() + 1),
      ),
    ).toBe("overdue");
  });
});

describe("resolveDisplayStatus", () => {
  const issuedAt = new Date("2026-05-01T12:00:00.000Z");

  it("draft when not issued", () => {
    expect(
      resolveDisplayStatus(
        {
          issuedAt: null,
          dueDate: "2026-05-17",
          paidAt: null,
          cancelledAt: null,
          issueDate: "2026-05-03",
        },
        "2026-05-10",
      ),
    ).toBe("draft");
  });

  it("unpaid when issued today or earlier and not due", () => {
    expect(
      resolveDisplayStatus(
        {
          issuedAt,
          dueDate: "2026-05-17",
          paidAt: null,
          cancelledAt: null,
          issueDate: "2026-05-03",
        },
        "2026-05-10",
      ),
    ).toBe("unpaid");
  });

  it("overdue when due date before today", () => {
    expect(
      resolveDisplayStatus(
        {
          issuedAt,
          dueDate: "2026-05-01",
          paidAt: null,
          cancelledAt: null,
          issueDate: "2026-04-20",
        },
        "2026-05-10",
      ),
    ).toBe("overdue");
  });

  it("future wins over overdue when issueDate is after today", () => {
    expect(
      resolveDisplayStatus(
        {
          issuedAt,
          dueDate: "2026-05-01",
          paidAt: null,
          cancelledAt: null,
          issueDate: "2026-06-01",
        },
        "2026-05-10",
      ),
    ).toBe("future");
  });

  it("paid and cancelled take priority", () => {
    expect(
      resolveDisplayStatus(
        {
          issuedAt,
          dueDate: "2026-05-17",
          paidAt: new Date(),
          cancelledAt: null,
          issueDate: "2026-06-01",
        },
        "2026-05-10",
      ),
    ).toBe("paid");
    expect(
      resolveDisplayStatus(
        {
          issuedAt,
          dueDate: "2026-05-17",
          paidAt: new Date(),
          cancelledAt: new Date(),
          issueDate: "2026-06-01",
        },
        "2026-05-10",
      ),
    ).toBe("cancelled");
  });

  it("normalizeDisplayStatusParam maps issued to unpaid", () => {
    expect(normalizeDisplayStatusParam("issued")).toBe("unpaid");
    expect(normalizeDisplayStatusParam("future")).toBe("future");
    expect(normalizeDisplayStatusParam("nope")).toBeNull();
  });

  it("pragueTodayIso is YYYY-MM-DD in Europe/Prague", () => {
    expect(pragueTodayIso(new Date("2026-05-10T22:00:00.000Z"))).toBe(
      "2026-05-11",
    );
    expect(pragueTodayIso(new Date("2026-05-10T12:00:00.000Z"))).toBe(
      "2026-05-10",
    );
  });
});
