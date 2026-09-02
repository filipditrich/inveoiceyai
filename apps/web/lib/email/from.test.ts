import { describe, expect, it } from "vitest";

import {
  applyDisplayNameTemplate,
  buildViaInvoiceyDisplayName,
  parseEmailFrom,
  parseEmailSystemFrom,
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
    const parsed = parseEmailFrom("Invoicey <invoices@invoicey.app>");
    expect(parsed.address).toBe("invoices@invoicey.app");
    expect(parsed.display).toBe("Invoicey");
  });

  it("parses EMAIL_SYSTEM_FROM with noreply default", () => {
    expect(parseEmailSystemFrom(undefined).address).toBe(
      "noreply@invoicey.app",
    );
    expect(
      parseEmailSystemFrom("Invoicey <noreply@invoicey.app>").address,
    ).toBe("noreply@invoicey.app");
  });

  it("applies display name templates", () => {
    expect(
      applyDisplayNameTemplate("{issuerName} via Invoicey", {
        issuerName: "ACME",
      }),
    ).toBe("ACME via Invoicey");
  });
});
