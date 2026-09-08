import { describe, expect, it } from "vitest";

import {
  allocatePaymentRequestSymbol,
  generatePaymentRequestSymbol,
} from "./payment-request-symbol";

describe("generatePaymentRequestSymbol", () => {
  it("prefixes 9 onto nine random digits", () => {
    expect(generatePaymentRequestSymbol(() => "123456789")).toBe("9123456789");
  });

  it("rejects entropy that is not nine digits", () => {
    expect(() => generatePaymentRequestSymbol(() => "123")).toThrow(
      "payment_request_symbol_entropy",
    );
  });
});

describe("allocatePaymentRequestSymbol", () => {
  it("retries when the symbol is taken by a request or an invoice", async () => {
    const digits = ["111111111", "222222222", "333333333"];
    const taken = new Set(["9111111111", "9222222222"]);

    const symbol = await allocatePaymentRequestSymbol({
      isTaken: (candidate) => taken.has(candidate),
      randomDigits: () => digits.shift() ?? "000000000",
    });

    expect(symbol).toBe("9333333333");
  });

  it("fails closed when every attempt collides", async () => {
    await expect(
      allocatePaymentRequestSymbol({
        isTaken: () => true,
        randomDigits: () => "123456789",
        maxAttempts: 3,
      }),
    ).rejects.toThrow("payment_request_symbol_exhausted");
  });
});
