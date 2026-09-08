import { describe, expect, it } from "vitest";

import { resolveCollectionProgress } from "./invoice-collection";

describe("resolveCollectionProgress", () => {
  it("keeps the whole amount open before any payment arrives", () => {
    expect(resolveCollectionProgress("1210.00", "0.00", "unpaid")).toEqual({
      paidAmount: "0.00",
      outstandingAmount: "1210.00",
      settled: false,
    });
  });

  it("asks a partially paid invoice only for the remaining amount", () => {
    expect(resolveCollectionProgress("1210.00", "210.50", "partial")).toEqual({
      paidAmount: "210.50",
      outstandingAmount: "999.50",
      settled: false,
    });
  });

  it("treats paid and overpaid invoices as settled", () => {
    expect(resolveCollectionProgress("1210.00", "1210.00", "paid")).toEqual({
      paidAmount: "1210.00",
      outstandingAmount: "0.00",
      settled: true,
    });
    expect(resolveCollectionProgress("1210.00", "1300.00", "overpaid")).toEqual(
      {
        paidAmount: "1300.00",
        outstandingAmount: "0.00",
        settled: true,
      },
    );
  });
});
