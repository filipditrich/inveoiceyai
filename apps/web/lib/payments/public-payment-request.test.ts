import { describe, expect, it } from "vitest";

import { toPublicPaymentRequestView } from "./public-payment-request";

const base = {
  amount: "1.00",
  allocatedAmount: "0",
  message: "Test",
  variableSymbol: "9099392505",
  settledAt: null,
  issuerName: "Filip Ditrich",
  accountNumber: "2203455311/2010",
  iban: "CZ9708000000001920014539",
  bic: "GIBACZPX",
  status: "open",
};

describe("toPublicPaymentRequestView", () => {
  it("hides a cancelled request", () => {
    expect(
      toPublicPaymentRequestView({ ...base, status: "cancelled" }),
    ).toBeNull();
  });

  it("keeps the QR while the request is still unpaid", () => {
    const view = toPublicPaymentRequestView(base);
    expect(view?.settled).toBe(false);
    expect(view?.qrPayload).toContain("*AM:1*");
    expect(view?.outstandingAmount).toBe("1.00");
  });

  it("asks only for the remainder after a partial credit", () => {
    const view = toPublicPaymentRequestView({
      ...base,
      amount: "10.00",
      allocatedAmount: "4.00",
    });
    expect(view?.settled).toBe(false);
    expect(view?.qrPayload).toContain("*AM:6*");
    expect(view?.paidAmount).toBe("4.00");
  });

  it("drops the QR once the allocated amount settles the request", () => {
    const settledAt = new Date("2026-09-09T10:00:00.000Z");
    const view = toPublicPaymentRequestView({
      ...base,
      status: "settled",
      allocatedAmount: "1.00",
      settledAt,
    });
    expect(view).toMatchObject({
      settled: true,
      paymentState: "paid",
      qrPayload: null,
      paidAmount: "1.00",
      outstandingAmount: "0.00",
      settledAt,
    });
  });
});
