import { describe, expect, it } from "vitest";

import { paymentMatchFactors } from "./payment-match-explanation";

describe("payment match explanations", () => {
  it("orders stored proposal factors deterministically", () => {
    expect(
      paymentMatchFactors([
        "plausible_date",
        "exact_outstanding_amount",
        "exact_variable_symbol",
      ]),
    ).toEqual([
      "exact_variable_symbol",
      "exact_outstanding_amount",
      "plausible_date",
    ]);
  });
});
