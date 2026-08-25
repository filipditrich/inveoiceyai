import { describe, expect, it } from "vitest";
import { resolveInvoiceLifecycleState } from "./invoice-lifecycle-guidance";

describe("invoice lifecycle guidance", () => {
  it("covers every visible accounting state exhaustively", () => {
    expect(resolveInvoiceLifecycleState("draft", "unpaid")).toBe("draft");
    expect(resolveInvoiceLifecycleState("unpaid", "partial")).toBe("partial");
    expect(resolveInvoiceLifecycleState("unpaid", "overpaid")).toBe("overpaid");
    expect(resolveInvoiceLifecycleState("overdue", "unpaid")).toBe("overdue");
    expect(resolveInvoiceLifecycleState("paid", "paid")).toBe("paid");
    expect(resolveInvoiceLifecycleState("future", "unpaid")).toBe("future");
    expect(resolveInvoiceLifecycleState("cancelled", "paid")).toBe("cancelled");
    expect(resolveInvoiceLifecycleState("unpaid", "unpaid")).toBe("unpaid");
  });
});
