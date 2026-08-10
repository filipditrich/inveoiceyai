import { describe, expect, it } from "vitest";

import { parseAmountCz } from "./parse-amount-cz";

describe("parseAmountCz", () => {
  it("parses spaced thousands with Kč", () => {
    expect(parseAmountCz("50 000 Kč")).toEqual({ ok: true, amount: 50_000 });
  });

  it("parses Czech comma decimal", () => {
    expect(parseAmountCz("1.000,50")).toEqual({ ok: true, amount: 1000.5 });
  });

  it("rejects empty", () => {
    expect(parseAmountCz("   ")).toEqual({ ok: false });
  });
});
