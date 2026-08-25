import { describe, expect, it } from "vitest";

import {
  compatiblePaymentRunAccounts,
  paymentRunSelection,
} from "./payment-run-selection";

const rows = [
  { id: "one", issuerId: "issuer-a", currency: "CZK" },
  { id: "two", issuerId: "issuer-a", currency: "CZK" },
  { id: "three", issuerId: "issuer-b", currency: "CZK" },
  { id: "four", issuerId: "issuer-a", currency: "EUR" },
];

const accounts = [
  { id: "a-czk", currency: "CZK", issuerIds: ["issuer-a"] },
  { id: "a-eur", currency: "EUR", issuerIds: ["issuer-a"] },
  { id: "b-czk", currency: "CZK", issuerIds: ["issuer-b"] },
];

describe("payment-run selection", () => {
  it("allows only invoices compatible with the selected issuer and currency", () => {
    expect(paymentRunSelection(rows, ["one"])).toEqual({
      issuerId: "issuer-a",
      currency: "CZK",
      compatibleIds: ["one", "two"],
    });
  });

  it("shows only accounts mapped to the selected issuer and currency", () => {
    expect(
      compatiblePaymentRunAccounts(accounts, "issuer-a", "CZK").map(
        (account) => account.id,
      ),
    ).toEqual(["a-czk"]);
  });
});
