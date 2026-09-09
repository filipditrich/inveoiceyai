import { describe, expect, it } from "vitest";

import { requestPaymentState } from "./request-payment-state";

describe("requestPaymentState", () => {
  it("stays unpaid when the row is marked settled but nothing is allocated", () => {
    expect(requestPaymentState("settled", "1.00", "0")).toBe("unpaid");
    expect(requestPaymentState("settled", "1.00", "0.00")).toBe("unpaid");
  });

  it("follows the allocated amount, not the status flag", () => {
    expect(requestPaymentState("open", "500.00", "200.00")).toBe("partial");
    expect(requestPaymentState("open", "1.00", "1.00")).toBe("paid");
    expect(requestPaymentState("settled", "1.00", "1.00")).toBe("paid");
    expect(requestPaymentState("settled", "1.00", "2.00")).toBe("overpaid");
  });
});
