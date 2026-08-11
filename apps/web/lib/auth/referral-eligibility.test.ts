import { describe, expect, it } from "vitest";

import {
  isEligibleForReferralAttribution,
  REFERRAL_ATTRIBUTION_WINDOW_MS,
} from "./referral-eligibility";

describe("isEligibleForReferralAttribution", () => {
  const now = new Date("2026-08-11T20:00:00.000Z");

  it("accepts accounts created just now", () => {
    expect(
      isEligibleForReferralAttribution(
        new Date("2026-08-11T19:59:00.000Z"),
        now,
      ),
    ).toBe(true);
  });

  it("rejects accounts older than the window", () => {
    expect(
      isEligibleForReferralAttribution(
        new Date(now.getTime() - REFERRAL_ATTRIBUTION_WINDOW_MS - 1),
        now,
      ),
    ).toBe(false);
  });

  it("rejects invalid dates", () => {
    expect(isEligibleForReferralAttribution("not-a-date", now)).toBe(false);
  });
});
