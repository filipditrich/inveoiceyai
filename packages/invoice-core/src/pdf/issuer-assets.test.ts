import { describe, expect, it } from "vitest";

import { invoiceShowsIssuerAsset } from "./issuer-assets";

describe("invoiceShowsIssuerAsset", () => {
  it("shows artwork when the invoice does not opt out", () => {
    expect(invoiceShowsIssuerAsset(undefined)).toBe(true);
  });

  it("shows artwork when the invoice asks for it", () => {
    expect(invoiceShowsIssuerAsset(true)).toBe(true);
  });

  it("hides artwork only when the invoice opts out", () => {
    expect(invoiceShowsIssuerAsset(false)).toBe(false);
  });
});
