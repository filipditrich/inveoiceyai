import { describe, expect, it } from "vitest";

import {
  czechAccountToIban,
  czIbanMatchesAccount,
  isValidCzIban,
  parseCzAccountParts,
  suggestCzIban,
} from "./czech-iban";

describe("czech IBAN helpers", () => {
  it("parses account parts with and without prefix", () => {
    expect(parseCzAccountParts("19-2000145399/0800")).toEqual({
      prefix: "19",
      number: "2000145399",
      bankCode: "0800",
    });
    expect(parseCzAccountParts("1920014539/0800")).toEqual({
      prefix: "",
      number: "1920014539",
      bankCode: "0800",
    });
  });

  it("builds a known ČSOB IBAN", () => {
    expect(czechAccountToIban("19-2000145399/0800")).toBe(
      "CZ6508000000192000145399",
    );
  });

  it("validates mod97 and rejects bad check digits", () => {
    expect(isValidCzIban("CZ6508000000192000145399")).toBe(true);
    expect(isValidCzIban("CZ6508000000192000145399")).toBe(true);
    expect(isValidCzIban("CZ00 0800 0000 1920 0014 5399")).toBe(false);
    expect(isValidCzIban("CZ6508000000192000145398")).toBe(false);
  });

  it("checks IBAN ↔ account consistency", () => {
    const iban = czechAccountToIban("19-2000145399/0800");
    expect(czIbanMatchesAccount(iban, "19-2000145399/0800")).toBe(true);
    expect(czIbanMatchesAccount(iban, "123456789/0100")).toBe(false);
  });

  it("suggests IBAN or returns null on invalid account", () => {
    expect(suggestCzIban("19-2000145399/0800")).toBe(
      "CZ6508000000192000145399",
    );
    expect(suggestCzIban("not-an-account")).toBeNull();
  });
});
