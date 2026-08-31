import { describe, expect, it } from "vitest";

import { currencyDisplaySuffix, invoiceDisplayUnit } from "./schema";

describe("currencyDisplaySuffix", () => {
  it("uses Kč for Czech CZK invoices", () => {
    expect(currencyDisplaySuffix("CZK", "cs")).toBe("Kč");
  });

  it("uses the ISO code for English CZK invoices", () => {
    expect(currencyDisplaySuffix("CZK", "en")).toBe("CZK");
  });

  it("keeps EUR and USD as ISO codes in both languages", () => {
    expect(currencyDisplaySuffix("EUR", "cs")).toBe("EUR");
    expect(currencyDisplaySuffix("EUR", "en")).toBe("EUR");
    expect(currencyDisplaySuffix("USD", "cs")).toBe("USD");
    expect(currencyDisplaySuffix("USD", "en")).toBe("USD");
  });
});

describe("invoiceDisplayUnit", () => {
  it("keeps ks on Czech invoices", () => {
    expect(invoiceDisplayUnit("ks", "cs")).toBe("ks");
  });

  it("maps ks to pcs on English invoices", () => {
    expect(invoiceDisplayUnit("ks", "en")).toBe("pcs");
    expect(invoiceDisplayUnit("hod", "en")).toBe("hrs");
  });

  it("leaves unknown units unchanged", () => {
    expect(invoiceDisplayUnit("kg", "en")).toBe("kg");
  });
});
