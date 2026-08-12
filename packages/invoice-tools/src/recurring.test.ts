import { describe, expect, it } from "vitest";

import { InvoiceSchema, type Invoice } from "@invoicey/invoice-core/schema";

import {
  addCadence,
  advanceNextRunUntilFuture,
  buildRecurringDraft,
  defaultNextRunOn,
  nextOccurrenceOnOrAfter,
  paymentDueDays,
  variableSymbolFromNumber,
} from "./recurring";

function sampleInvoice(): Invoice {
  return InvoiceSchema.parse({
    meta: {
      docType: "invoice",
      number: "20260001",
      issueDate: "2026-05-03",
      dueDate: "2026-05-17",
      duzp: "2026-05-03",
      language: "cs",
      currency: "CZK",
    },
    issuer: {
      id: "ca8b8d4e-2e7e-4f6a-9b7d-1f9c1234abcd",
      name: "Filip Ditrich",
      ico: "12345678",
      dic: "CZ12345678",
      address: {
        street: "Na Příkopě 14",
        city: "Praha",
        zip: "110 00",
        country: "CZ",
      },
      bank: {
        accountNumber: "1920014539/0800",
        iban: "CZ9708000000001920014539",
        bic: "GIBACZPX",
      },
      vatPayer: true,
      contactEmail: "faktura@filipditrich.demo",
    },
    client: {
      id: "5bc1d5a7-0c58-4cda-a1f6-4ad9876543ff",
      name: "NFCtron s.r.o.",
      ico: "07654321",
      dic: "CZ07654321",
      address: {
        street: "Křížová 2598/4",
        city: "Brno",
        zip: "603 00",
        country: "CZ",
      },
      contactEmail: "billing@nfctron.com",
    },
    vat: { mode: "regular", suppliesAbroad: "none" },
    payment: {
      method: "transfer",
      bankAccount: {
        accountNumber: "1920014539/0800",
        iban: "CZ9708000000001920014539",
        bic: "GIBACZPX",
      },
      variableSymbol: "20260001",
    },
    items: [
      {
        position: 1,
        description: "Práce",
        quantity: 1,
        unit: "ks",
        unitPriceWithoutVat: 1000,
        vatRate: 21,
        lineSubtotal: 1000,
        lineVat: 210,
        lineTotal: 1210,
      },
    ],
    totals: {
      subtotal: 1000,
      vatBreakdown: [{ rate: 21, base: 1000, vat: 210 }],
      vatTotal: 210,
      total: 1210,
    },
  });
}

describe("paymentDueDays", () => {
  it("counts inclusive calendar days", () => {
    expect(paymentDueDays("2026-05-03", "2026-05-17")).toBe(14);
    expect(paymentDueDays("2026-05-03", "2026-05-03")).toBe(0);
  });

  it("never goes negative", () => {
    expect(paymentDueDays("2026-05-17", "2026-05-03")).toBe(0);
  });
});

describe("nextOccurrenceOnOrAfter", () => {
  it("uses this month when the day is still upcoming", () => {
    expect(nextOccurrenceOnOrAfter("2026-08-12", 15)).toBe("2026-08-15");
  });

  it("rolls to next month when the day already passed", () => {
    expect(nextOccurrenceOnOrAfter("2026-08-12", 1)).toBe("2026-09-01");
  });

  it("accepts day 28 in February", () => {
    expect(nextOccurrenceOnOrAfter("2026-02-01", 28)).toBe("2026-02-28");
    expect(nextOccurrenceOnOrAfter("2026-02-28", 28)).toBe("2026-02-28");
    expect(nextOccurrenceOnOrAfter("2026-03-01", 28)).toBe("2026-03-28");
  });
});

describe("addCadence", () => {
  it("adds one month", () => {
    expect(addCadence("2026-08-01", "monthly", 1)).toBe("2026-09-01");
    expect(addCadence("2026-12-15", "monthly", 15)).toBe("2027-01-15");
  });

  it("adds three months for quarterly", () => {
    expect(addCadence("2026-01-28", "quarterly", 28)).toBe("2026-04-28");
    expect(addCadence("2026-11-01", "quarterly", 1)).toBe("2027-02-01");
  });

  it("adds seven days for weekly", () => {
    expect(addCadence("2026-08-12", "weekly", 1)).toBe("2026-08-19");
  });

  it("adds twelve months for yearly", () => {
    expect(addCadence("2026-08-12", "yearly", 12)).toBe("2027-08-12");
  });

  it("clamps last-of-month through short months", () => {
    expect(addCadence("2026-01-31", "monthly", 31)).toBe("2026-02-28");
    expect(nextOccurrenceOnOrAfter("2026-01-01", 31)).toBe("2026-01-31");
    expect(nextOccurrenceOnOrAfter("2026-02-01", 31)).toBe("2026-02-28");
  });
});

describe("advanceNextRunUntilFuture", () => {
  it("jumps past overdue months without backfill", () => {
    expect(
      advanceNextRunUntilFuture("2026-06-01", "2026-08-12", "monthly", 1),
    ).toBe("2026-09-01");
  });

  it("advances once when next run is today", () => {
    expect(
      advanceNextRunUntilFuture("2026-08-12", "2026-08-12", "monthly", 12),
    ).toBe("2026-09-12");
  });

  it("skips one future occurrence", () => {
    expect(
      advanceNextRunUntilFuture("2026-09-01", "2026-08-12", "monthly", 1),
    ).toBe("2026-10-01");
  });
});

describe("defaultNextRunOn", () => {
  it("never schedules same-day", () => {
    expect(defaultNextRunOn("2026-08-12", 12)).toBe("2026-09-12");
    expect(defaultNextRunOn("2026-08-12", 13)).toBe("2026-08-13");
  });

  it("uses tomorrow for weekly", () => {
    expect(defaultNextRunOn("2026-08-12", 1, "weekly")).toBe("2026-08-13");
  });
});

describe("buildRecurringDraft", () => {
  it("resets dates, number, and live snapshots", () => {
    const template = sampleInvoice();
    const issuer = {
      ...template.issuer,
      name: "Live Issuer s.r.o.",
    };
    const client = {
      ...template.client,
      name: "Live Client a.s.",
    };
    const result = buildRecurringDraft({
      template,
      issuer,
      client,
      todayIso: "2026-08-12",
      paymentDueDays: 14,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.invoice.meta.number).toBe("DRAFT");
    expect(result.invoice.meta.issueDate).toBe("2026-08-12");
    expect(result.invoice.meta.duzp).toBe("2026-08-12");
    expect(result.invoice.meta.dueDate).toBe("2026-08-26");
    expect(result.invoice.issuer.name).toBe("Live Issuer s.r.o.");
    expect(result.invoice.client.name).toBe("Live Client a.s.");
    expect(result.invoice.totals.total).toBe(1210);
    expect(result.invoice.payment.variableSymbol).toBeUndefined();
  });

  it("zeroes VAT when the live issuer is not a VAT payer", () => {
    const template = sampleInvoice();
    const issuer = { ...template.issuer, vatPayer: false, dic: undefined };
    const result = buildRecurringDraft({
      template,
      issuer,
      client: template.client,
      todayIso: "2026-08-12",
      paymentDueDays: 14,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.invoice.items[0]?.vatRate).toBe(0);
    expect(result.invoice.totals.vatTotal).toBe(0);
    expect(result.invoice.totals.total).toBe(1000);
  });
});

describe("variableSymbolFromNumber", () => {
  it("keeps up to 10 digits", () => {
    expect(variableSymbolFromNumber("20260001")).toBe("20260001");
    expect(variableSymbolFromNumber("FV-2026-0001")).toBe("20260001");
  });

  it("returns undefined when there are no digits", () => {
    expect(variableSymbolFromNumber("DRAFT")).toBeUndefined();
  });
});
