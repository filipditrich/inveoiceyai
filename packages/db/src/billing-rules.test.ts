import { describe, expect, it } from "vitest";

import {
  availableAiTokens,
  canCheckoutPlanOffer,
  canCheckoutTokenPack,
  isLiveSubscriptionStatus,
  paidAccessEnded,
  planKeyForOffer,
  purchasedDebtBlocksAi,
  refundedTokenDelta,
  shouldResetMonthlyAllowance,
  showsCancelingBanner,
  showsPastDueBanner,
  tokenPackAmount,
} from "./billing-rules";

describe("offer mapping", () => {
  it("maps both Pro cadences to the Pro plan row", () => {
    expect(planKeyForOffer("pro_monthly")).toBe("pro");
    expect(planKeyForOffer("pro_yearly")).toBe("pro");
    expect(planKeyForOffer("tokens_small")).toBeNull();
  });

  it("uses the pinned pack sizes", () => {
    expect(tokenPackAmount("tokens_small")).toBe(2_000_000);
    expect(tokenPackAmount("tokens_medium")).toBe(10_000_000);
    expect(tokenPackAmount("tokens_large")).toBe(50_000_000);
    expect(tokenPackAmount("pro_monthly")).toBeNull();
  });
});

describe("refundedTokenDelta", () => {
  it("reverses the full pack on a full refund", () => {
    expect(
      refundedTokenDelta({
        packTokens: 2_000_000,
        originalAmount: 1000,
        newRefundedAmount: 1000,
        alreadyReversed: 0,
      }),
    ).toBe(2_000_000);
  });

  it("floors a partial refund and only applies the new delta", () => {
    expect(
      refundedTokenDelta({
        packTokens: 10_000_000,
        originalAmount: 3000,
        newRefundedAmount: 1000,
        alreadyReversed: 0,
      }),
    ).toBe(3_333_333);
    expect(
      refundedTokenDelta({
        packTokens: 10_000_000,
        originalAmount: 3000,
        newRefundedAmount: 1000,
        alreadyReversed: 3_333_333,
      }),
    ).toBe(0);
  });

  it("does not double-count when Polar repeats the same cumulative refund", () => {
    const first = refundedTokenDelta({
      packTokens: 2_000_000,
      originalAmount: 500,
      newRefundedAmount: 250,
      alreadyReversed: 0,
    });
    const replay = refundedTokenDelta({
      packTokens: 2_000_000,
      originalAmount: 500,
      newRefundedAmount: 250,
      alreadyReversed: first,
    });
    expect(replay).toBe(0);
  });

  it("returns 0 when the original amount is missing", () => {
    expect(
      refundedTokenDelta({
        packTokens: 2_000_000,
        originalAmount: 0,
        newRefundedAmount: 100,
        alreadyReversed: 0,
      }),
    ).toBe(0);
  });
});

describe("subscription access", () => {
  it("keeps access through past_due and scheduled cancel", () => {
    expect(paidAccessEnded({ status: "past_due", endedAt: null })).toBe(false);
    expect(paidAccessEnded({ status: "active", endedAt: null })).toBe(false);
    expect(paidAccessEnded({ status: "canceled", endedAt: null })).toBe(false);
    expect(showsPastDueBanner("past_due")).toBe(true);
    expect(
      showsCancelingBanner({
        status: "active",
        cancelAtPeriodEnd: true,
        endedAt: null,
      }),
    ).toBe(true);
  });

  it("ends access on revoked or ended_at", () => {
    expect(paidAccessEnded({ status: "revoked", endedAt: null })).toBe(true);
    expect(
      paidAccessEnded({ status: "canceled", endedAt: new Date("2026-01-01") }),
    ).toBe(true);
    expect(isLiveSubscriptionStatus("revoked")).toBe(false);
    expect(isLiveSubscriptionStatus("active")).toBe(true);
    expect(isLiveSubscriptionStatus("past_due")).toBe(true);
  });

  it("resets monthly tokens only on paid create/cycle", () => {
    expect(shouldResetMonthlyAllowance("subscription_create")).toBe(true);
    expect(shouldResetMonthlyAllowance("subscription_cycle")).toBe(true);
    expect(shouldResetMonthlyAllowance("purchase")).toBe(false);
    expect(shouldResetMonthlyAllowance("subscription_update")).toBe(false);
  });
});

describe("checkout eligibility", () => {
  it("refuses custom and Enterprise plan checkout", () => {
    expect(
      canCheckoutPlanOffer({ planKind: "custom", planKey: "nfctron" }),
    ).toEqual({ ok: false, reason: "custom_plan" });
    expect(
      canCheckoutPlanOffer({ planKind: "builtin", planKey: "enterprise" }),
    ).toEqual({ ok: false, reason: "enterprise" });
    expect(
      canCheckoutPlanOffer({ planKind: "builtin", planKey: "free" }),
    ).toEqual({ ok: true });
    expect(
      canCheckoutPlanOffer({ planKind: "builtin", planKey: "pro" }),
    ).toEqual({ ok: true });
  });

  it("lets Free buy packs when top-up is on", () => {
    expect(canCheckoutTokenPack(true)).toEqual({ ok: true });
    expect(canCheckoutTokenPack(false)).toEqual({
      ok: false,
      reason: "top_up_disabled",
    });
  });
});

describe("purchased-token debt", () => {
  it("blocks AI while purchased remaining is negative", () => {
    expect(purchasedDebtBlocksAi(-1)).toBe(true);
    expect(purchasedDebtBlocksAi(0)).toBe(false);
    expect(
      availableAiTokens({
        monthlyRemaining: 1_500_000,
        giftedRemaining: 100,
        purchasedRemaining: -50,
      }),
    ).toBe(0);
    expect(
      availableAiTokens({
        monthlyRemaining: 10,
        giftedRemaining: 5,
        purchasedRemaining: 2,
      }),
    ).toBe(17);
  });
});
