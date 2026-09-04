import { describe, expect, it } from "vitest";

import { parseInvoiceDateInput } from "./format-invoice";

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
