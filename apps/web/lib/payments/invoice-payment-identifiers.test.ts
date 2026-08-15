import { describe, expect, it } from "vitest";

import { invoicePaymentIdentifiers } from "./invoice-payment-identifiers";

describe("invoicePaymentIdentifiers", () => {
  it("normalizes the IBAN and preserves the variable symbol", () => {
    expect(
      invoicePaymentIdentifiers({
        method: "transfer",
        bankAccount: {
          accountNumber: "2203455311/2010",
          iban: "cz15 2010 0000 0022 0345 5311",
        },
        variableSymbol: "20260118",
      }),
    ).toEqual({
      paymentAccountIban: "CZ1520100000002203455311",
      paymentVariableSymbol: "20260118",
    });
  });

  it("returns null identifiers for a cash payment", () => {
    expect(invoicePaymentIdentifiers({ method: "cash" })).toEqual({
      paymentAccountIban: null,
      paymentVariableSymbol: null,
    });
  });
});
