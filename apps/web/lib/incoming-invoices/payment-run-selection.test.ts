import { describe, expect, it } from "vitest";

import { selectEligiblePaymentRunIds } from "./payment-run-selection";

describe("selectEligiblePaymentRunIds", () => {
  it("does not create a run from rows that all have blockers", () => {
    expect(
      selectEligiblePaymentRunIds([
        { id: "invoice-1", blockers: ["unconfirmed_beneficiary"] },
        { id: "invoice-2", blockers: ["not_transfer"] },
      ]),
    ).toEqual([]);
  });

  it("keeps only rows without eligibility blockers", () => {
    expect(
      selectEligiblePaymentRunIds([
        { id: "invoice-1", blockers: [] },
        { id: "invoice-2", blockers: ["currency_mismatch"] },
        { id: "invoice-3", blockers: [] },
      ]),
    ).toEqual(["invoice-1", "invoice-3"]);
  });
});
