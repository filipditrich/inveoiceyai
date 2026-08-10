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
