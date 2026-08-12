import { describe, expect, it } from "vitest";

import { CreateInvoiceInputSchema } from "./create-invoice-input";

const validDraft = {
  meta: { issueDate: "2026-07-31", dueDate: "2026-08-14" },
  client: {
    name: "NFCtron a.s.",
    ico: "27074358",
    address: {
      street: "Rohanské nábřeží 678/23",
      city: "Praha",
      zip: "18600",
      country: "CZ",
    },
  },
  vat: { mode: "regular" as const, suppliesAbroad: "none" as const },
  payment: { method: "transfer" as const },
  items: [
    {
      description: "Vývoj produktu",
      quantity: 1,
      unit: "ks",
      unitPriceWithoutVat: 40_000,
      vatRate: 21,
    },
  ],
};

describe("CreateInvoiceInputSchema", () => {
  it("accepts a complete ARES-backed draft without line position", () => {
    const parsed = CreateInvoiceInputSchema.safeParse({ draft: validDraft });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty or missing draft bag", () => {
    expect(CreateInvoiceInputSchema.safeParse({}).success).toBe(false);
    expect(CreateInvoiceInputSchema.safeParse({ draft: {} }).success).toBe(
      false,
    );
  });

  it("rejects drafts missing vat, payment, or structured address", () => {
    const { vat: _vat, ...noVat } = validDraft;
    expect(CreateInvoiceInputSchema.safeParse({ draft: noVat }).success).toBe(
      false,
    );
    const { payment: _payment, ...noPay } = validDraft;
    expect(CreateInvoiceInputSchema.safeParse({ draft: noPay }).success).toBe(
      false,
    );
    expect(
      CreateInvoiceInputSchema.safeParse({
        draft: {
          ...validDraft,
          client: { name: "NFCtron a.s.", address: "Praha" },
        },
      }).success,
    ).toBe(false);
  });
});
