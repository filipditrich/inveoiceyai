import { describe, expect, it } from "vitest";

import { diffDaysIso } from "./build-invoice";
import {
  suggestionsFromInvoice,
  truncateHint,
} from "./last-invoice-suggestions";

describe("diffDaysIso", () => {
  it("counts inclusive calendar span as whole days", () => {
    expect(diffDaysIso("2026-08-12", "2026-08-26")).toBe(14);
    expect(diffDaysIso("2026-08-12", "2026-08-12")).toBe(0);
  });

  it("returns 0 for invalid dates", () => {
    expect(diffDaysIso("nope", "2026-08-12")).toBe(0);
  });
});

describe("suggestionsFromInvoice", () => {
  it("maps due days, vat, notes, and lines", () => {
    const suggestions = suggestionsFromInvoice({
      meta: {
        number: "20260001",
        issueDate: "2026-08-01",
        dueDate: "2026-08-15",
        currency: "EUR",
        language: "en",
      },
      vat: {
        mode: "reverse_charge",
        suppliesAbroad: "eu",
        legalNote: " Tax is due by the customer ",
        localReverseChargeCode: "15",
      },
      notes: "  Thank you  ",
      items: [
        {
          description: "Consulting",
          quantity: 8,
          unit: "hod",
          unitPriceWithoutVat: 1500,
          vatRate: 0,
        },
      ],
    });

    expect(suggestions.dueDays).toBe(14);
    expect(suggestions.currency).toBe("EUR");
    expect(suggestions.language).toBe("en");
    expect(suggestions.vatMode).toBe("reverse_charge");
    expect(suggestions.suppliesAbroad).toBe("eu");
    expect(suggestions.legalNote).toBe("Tax is due by the customer");
    expect(suggestions.localReverseChargeCode).toBe("15");
    expect(suggestions.notes).toBe("Thank you");
    expect(suggestions.items).toEqual([
      {
        description: "Consulting",
        quantity: 8,
        unit: "hod",
        unitPriceWithoutVat: 1500,
        vatRate: 0,
      },
    ]);
  });

  it("drops blank optional strings", () => {
    const suggestions = suggestionsFromInvoice({
      meta: {
        number: "20260002",
        issueDate: "2026-08-01",
        dueDate: "2026-08-01",
        currency: "CZK",
        language: "cs",
      },
      vat: {
        mode: "regular",
        suppliesAbroad: "none",
      },
      items: [
        {
          description: "Work",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 100,
          vatRate: 21,
        },
      ],
    });
    expect(suggestions.legalNote).toBeNull();
    expect(suggestions.notes).toBeNull();
    expect(suggestions.dueDays).toBe(0);
  });
});

describe("truncateHint", () => {
  it("keeps short values", () => {
    expect(truncateHint("Consulting")).toBe("Consulting");
  });

  it("ellipsizes long values", () => {
    const long = "A".repeat(50);
    expect(truncateHint(long, 10)).toBe("AAAAAAAAAA…");
  });
});
