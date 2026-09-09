import { describe, expect, it } from "vitest";

import offsetDepositFixture from "../__fixtures__/invoices/offset-deposit.json";
import remainderFixture from "../__fixtures__/invoices/paid-deposit-remainder.json";
import { invoiceLabels } from "../labels";
import { InvoiceSchema } from "../schema";
import {
  invoicePayability,
  parseInvoiceDateInput,
  paymentDisplayLabel,
  paymentMethodFullLabel,
  paymentMethodLabel,
  paymentNoticeText,
} from "./format-invoice";

describe("parseInvoiceDateInput", () => {
  it("accepts ISO and Czech dotted dates as a calendar day", () => {
    expect(parseInvoiceDateInput("2026-09-04")).toBe("2026-09-04");
    expect(parseInvoiceDateInput("04.09.2026")).toBe("2026-09-04");
    expect(parseInvoiceDateInput("4.9.2026")).toBe("2026-09-04");
    expect(parseInvoiceDateInput("04. 09. 2026")).toBe("2026-09-04");
    expect(parseInvoiceDateInput("04/09/2026")).toBe("2026-09-04");
  });

  it("rejects empty, partial, and impossible calendar days", () => {
    expect(parseInvoiceDateInput("")).toBeNull();
    expect(parseInvoiceDateInput("04.09.")).toBeNull();
    expect(parseInvoiceDateInput("32.01.2026")).toBeNull();
    expect(parseInvoiceDateInput("not a date")).toBeNull();
  });
});

describe("paymentMethodLabel", () => {
  const cs = invoiceLabels("cs");

  it("labels offset as zápočet", () => {
    expect(paymentMethodLabel("offset", cs)).toBe("Zápočtem");
    expect(paymentMethodFullLabel("offset", cs)).toBe("Platba zápočtem");
  });
});

describe("payability", () => {
  const cs = invoiceLabels("cs");

  it("uses methodLabel and explicit do_not_pay on the Magmafest fixture", () => {
    const invoice = InvoiceSchema.parse(offsetDepositFixture);
    expect(paymentDisplayLabel(invoice, cs)).toBe("Úhrada zálohou");
    expect(invoicePayability(invoice)).toBe("do_not_pay");
    expect(paymentNoticeText(invoice, cs)).toContain("neplaťte");
  });

  it("keeps the Ivan remainder-due sample payable", () => {
    const invoice = InvoiceSchema.parse(remainderFixture);
    expect(invoicePayability(invoice)).toBe("due");
    expect(invoice.totals.total).toBe(81058.55);
    expect(paymentNoticeText(invoice, cs)).toBeNull();
  });

  it("infers do_not_pay when offset totals zero", () => {
    const invoice = InvoiceSchema.parse({
      ...offsetDepositFixture,
      payment: { method: "offset" },
    });
    expect(invoicePayability(invoice)).toBe("do_not_pay");
  });
});
