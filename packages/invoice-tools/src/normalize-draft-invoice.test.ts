import { describe, expect, it } from "vitest";

import { getDemoIssuer } from "./demo-issuer";
import { normalizeDraftToInvoice } from "./normalize-draft-invoice";

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
});
