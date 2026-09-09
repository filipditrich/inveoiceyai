import { describe, expect, it } from "vitest";

import { decidePaymentRequestMatch } from "./payment-request-settlement";

const open = {
  id: "req-open",
  status: "open" as const,
  amount: "500.00",
  allocated: "0.00",
  variableSymbol: "9123456789",
};

describe("decidePaymentRequestMatch", () => {
  it("auto-settles exact symbol and exact remaining amount on an open request", () => {
    expect(
      decidePaymentRequestMatch({
        creditAmount: "500.00",
        creditSymbol: "9123456789",
        requests: [open],
      }),
    ).toEqual({
      action: "settle",
      requestId: "req-open",
      amount: "500.00",
    });
  });

  it("records a short exact-symbol credit without marking the request paid", () => {
    expect(
      decidePaymentRequestMatch({
        creditAmount: "200.00",
        creditSymbol: "9123456789",
        requests: [open],
      }),
    ).toEqual({
      action: "partial",
      requestId: "req-open",
      amount: "200.00",
    });
  });

  it("settles an overpayment for the remaining ask and flags the excess", () => {
    expect(
      decidePaymentRequestMatch({
        creditAmount: "700.00",
        creditSymbol: "9123456789",
        requests: [open],
      }),
    ).toEqual({
      action: "settle",
      requestId: "req-open",
      amount: "500.00",
      overAmount: "200.00",
    });
  });

  it("never settles a second credit against an already settled request", () => {
    expect(
      decidePaymentRequestMatch({
        creditAmount: "500.00",
        creditSymbol: "9123456789",
        requests: [{ ...open, status: "settled", allocated: "500.00" }],
      }),
    ).toEqual({ action: "duplicate", requestId: "req-open" });
  });

  it("proposes a no-symbol exact amount against the one open request", () => {
    expect(
      decidePaymentRequestMatch({
        creditAmount: "500.00",
        creditSymbol: null,
        requests: [open],
      }),
    ).toEqual({
      action: "propose",
      requestIds: ["req-open"],
      amount: "500.00",
    });
  });

  it("proposes every open request when a no-symbol exact amount is ambiguous", () => {
    expect(
      decidePaymentRequestMatch({
        creditAmount: "500.00",
        creditSymbol: null,
        requests: [
          open,
          { ...open, id: "req-two", variableSymbol: "9987654321" },
        ],
      }),
    ).toEqual({
      action: "propose",
      requestIds: ["req-open", "req-two"],
      amount: "500.00",
    });
  });

  it("leaves a cancelled request unmatched so cancellation is not a delete", () => {
    expect(
      decidePaymentRequestMatch({
        creditAmount: "500.00",
        creditSymbol: "9123456789",
        requests: [{ ...open, status: "cancelled" }],
      }),
    ).toEqual({ action: "unmatched" });
  });

  it("does not consult invoice auto-confirm reasons", () => {
    const decision = decidePaymentRequestMatch({
      creditAmount: "500.00",
      creditSymbol: "9123456789",
      requests: [open],
    });
    expect(decision).not.toHaveProperty("score");
    expect(decision.action).toBe("settle");
  });
});
