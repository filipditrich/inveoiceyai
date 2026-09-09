import { describe, expect, it } from "vitest";

import {
  findSectionLanding,
  isInvoiceListPath,
  isInvoicesGroupPath,
  sectionSiblingPages,
} from "./section-nav";

describe("isInvoiceListPath", () => {
  it("treats the list and a detail as the invoices home", () => {
    expect(isInvoiceListPath("/invoices")).toBe(true);
    expect(isInvoiceListPath("/invoices/abc")).toBe(true);
  });

  it("excludes create and sibling landings", () => {
    expect(isInvoiceListPath("/invoices/new")).toBe(false);
    expect(isInvoiceListPath("/invoices/ai")).toBe(false);
    expect(isInvoiceListPath("/invoices/recurring")).toBe(false);
    expect(isInvoiceListPath("/invoices/import")).toBe(false);
    expect(isInvoiceListPath("/invoices/from-json")).toBe(false);
  });
});

describe("isInvoicesGroupPath", () => {
  it("includes sibling landings but not the dashboard", () => {
    expect(isInvoicesGroupPath("/invoices/from-json")).toBe(true);
    expect(isInvoicesGroupPath("/dashboard")).toBe(false);
  });
});

describe("findSectionLanding", () => {
  it("returns the invoices home only on the list url", () => {
    expect(findSectionLanding("invoices", "/invoices")?.index).toBe(0);
    expect(findSectionLanding("invoices", "/invoices/abc")).toBeNull();
  });

  it("finds sibling landings and ignores nested create or detail routes", () => {
    expect(findSectionLanding("invoices", "/invoices/recurring")?.index).toBe(
      1,
    );
    expect(findSectionLanding("payments", "/payments")?.index).toBe(0);
    expect(findSectionLanding("payments", "/payments/requests")?.index).toBe(1);
    expect(findSectionLanding("payments", "/payments/requests/new")).toBeNull();
  });
});

describe("sectionSiblingPages", () => {
  it("lists every other landing, including the home on the last page", () => {
    expect(
      sectionSiblingPages("invoices", "/invoices/from-json")?.map(
        (page) => page.id,
      ),
    ).toEqual(["invoicesHome", "invoicesRecurring", "invoicesImport"]);
    expect(
      sectionSiblingPages("payments", "/payments")?.map((page) => page.id),
    ).toEqual(["paymentsRequests", "paymentsConnections"]);
  });

  it("is null on nested create or detail routes", () => {
    expect(
      sectionSiblingPages("payments", "/payments/requests/new"),
    ).toBeNull();
  });
});
