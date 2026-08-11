import { describe, expect, it } from "vitest";

import { newReferralCode } from "./referral-code";

describe("newReferralCode", () => {
  it("returns a non-empty url-safe token", () => {
    const code = newReferralCode();
    expect(code.length).toBeGreaterThanOrEqual(8);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces unique values across calls", () => {
    const a = newReferralCode();
    const b = newReferralCode();
    expect(a).not.toBe(b);
  });
});
