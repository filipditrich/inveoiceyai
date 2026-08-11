import { describe, expect, it } from "vitest";

import {
  applyDisplayNameTemplate,
  buildViaInvoiceyDisplayName,
  parseEmailFrom,
} from "./from";

describe("from helpers", () => {
  it("builds via Invoicey display names", () => {
    expect(buildViaInvoiceyDisplayName("Filip")).toBe("Filip via Invoicey");
    expect(buildViaInvoiceyDisplayName("Filip via Invoicey")).toBe(
      "Filip via Invoicey",
    );
    expect(buildViaInvoiceyDisplayName("  ")).toBe("Invoicey");
  });

  it("parses EMAIL_FROM", () => {
    const parsed = parseEmailFrom("Invoicey <invoices@invoicey.ditrich.me>");
    expect(parsed.address).toBe("invoices@invoicey.ditrich.me");
    expect(parsed.display).toBe("Invoicey");
  });

  it("applies display name templates", () => {
    expect(
      applyDisplayNameTemplate("{issuerName} via Invoicey", {
        issuerName: "ACME",
      }),
    ).toBe("ACME via Invoicey");
  });
});
