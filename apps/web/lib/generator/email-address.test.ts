import { describe, expect, it } from "vitest";

import { isDisposableDomain, normalizeGuestEmail } from "./email-address";

describe("normalizeGuestEmail", () => {
  it("trims and lowercases a valid address", () => {
    expect(normalizeGuestEmail("  Jan@Firma.CZ ")).toBe("jan@firma.cz");
  });

  it("rejects missing local or domain parts", () => {
    expect(normalizeGuestEmail("not-an-email")).toBeNull();
    expect(normalizeGuestEmail("")).toBeNull();
    expect(normalizeGuestEmail("@firma.cz")).toBeNull();
  });
});

describe("isDisposableDomain", () => {
  it("matches bundled throwaway hosts regardless of case", () => {
    expect(isDisposableDomain("mailinator.com")).toBe(true);
    expect(isDisposableDomain("YopMail.COM")).toBe(true);
    expect(isDisposableDomain("gmail.com")).toBe(false);
    expect(isDisposableDomain("firma.cz")).toBe(false);
  });
});
