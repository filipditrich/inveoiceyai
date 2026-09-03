/**
 * Pure Polar → Invoicey billing rules (ADR 0047).
 *
 * Polar remains the charged amount. The CZK list prices below are the UI
 * catalog so marketing and Billing do not drift. Callers still resolve an
 * offer key first, then ask what Invoicey should do.
 */

export const BILLING_AUTHORITIES = ["manual", "polar"] as const;
export type BillingAuthority = (typeof BILLING_AUTHORITIES)[number];

export const BILLING_OFFER_KEYS = [
  "pro_monthly",
  "pro_yearly",
  "tokens_small",
  "tokens_medium",
  "tokens_large",
] as const;
export type BillingOfferKey = (typeof BILLING_OFFER_KEYS)[number];

export const TOKEN_PACK_AMOUNTS = {
  tokens_small: 2_000_000,
  tokens_medium: 10_000_000,
  tokens_large: 50_000_000,
} as const;

/** CZK list prices shown in Billing and on the public pricing page. */
export const BILLING_OFFER_CURRENCY = "CZK" as const;

export const BILLING_OFFER_PRICES = {
  pro_monthly: 99,
  pro_yearly: 799,
  tokens_small: 100,
  tokens_medium: 500,
  tokens_large: 1990,
} as const satisfies Record<BillingOfferKey, number>;

export const PLAN_OFFER_PLAN_KEYS = {
  pro_monthly: "pro",
  pro_yearly: "pro",
} as const;

export const LIVE_SUBSCRIPTION_STATUSES = [
  "active",
  "past_due",
  "canceled",
] as const;

export const MONTHLY_RESET_BILLING_REASONS = [
  "subscription_create",
  "subscription_cycle",
] as const;

export function isBillingOfferKey(value: string): value is BillingOfferKey {
  return BILLING_OFFER_KEYS.some((key) => key === value);
}

export function isPlanOffer(
  offerKey: BillingOfferKey,
): offerKey is keyof typeof PLAN_OFFER_PLAN_KEYS {
  return Object.hasOwn(PLAN_OFFER_PLAN_KEYS, offerKey);
}

export function isTokenPackOffer(
  offerKey: BillingOfferKey,
): offerKey is keyof typeof TOKEN_PACK_AMOUNTS {
  return Object.hasOwn(TOKEN_PACK_AMOUNTS, offerKey);
}

export function tokenPackAmount(offerKey: BillingOfferKey): number | null {
  if (!isTokenPackOffer(offerKey)) return null;
  return TOKEN_PACK_AMOUNTS[offerKey];
}

export function planKeyForOffer(offerKey: BillingOfferKey): string | null {
  if (!isPlanOffer(offerKey)) return null;
  return PLAN_OFFER_PLAN_KEYS[offerKey];
}

/**
 * Tokens to reverse for a newly observed cumulative refund on one Polar order.
 * `alreadyReversed` is what Invoicey has already taken back for this order.
 */
export function refundedTokenDelta(input: {
  packTokens: number;
  originalAmount: number;
  newRefundedAmount: number;
  alreadyReversed: number;
}): number {
  if (input.packTokens <= 0 || input.originalAmount <= 0) return 0;
  const refunded = Math.max(0, input.newRefundedAmount);
  const target = Math.floor(
    (input.packTokens * Math.min(refunded, input.originalAmount)) /
      input.originalAmount,
  );
  return Math.max(0, target - Math.max(0, input.alreadyReversed));
}

export function shouldResetMonthlyAllowance(billingReason: string): boolean {
  return MONTHLY_RESET_BILLING_REASONS.some(
    (reason) => reason === billingReason,
  );
}

/** Paid access ends only when Polar says the subscription is over. */
export function paidAccessEnded(input: {
  status: string;
  endedAt: Date | null;
}): boolean {
  return input.status === "revoked" || input.endedAt != null;
}

export function isLiveSubscriptionStatus(status: string): boolean {
  return LIVE_SUBSCRIPTION_STATUSES.some((live) => live === status);
}

export function showsPastDueBanner(status: string): boolean {
  return status === "past_due";
}

export function showsCancelingBanner(input: {
  status: string;
  cancelAtPeriodEnd: boolean;
  endedAt: Date | null;
}): boolean {
  if (paidAccessEnded(input)) return false;
  return input.cancelAtPeriodEnd || input.status === "canceled";
}

export type CheckoutRefusal =
  | "custom_plan"
  | "enterprise"
  | "top_up_disabled"
  | "unknown_offer";

export function canCheckoutPlanOffer(input: {
  planKind: "builtin" | "custom";
  planKey: string;
}): { ok: true } | { ok: false; reason: CheckoutRefusal } {
  if (input.planKind === "custom") return { ok: false, reason: "custom_plan" };
  if (input.planKey === "enterprise") {
    return { ok: false, reason: "enterprise" };
  }
  return { ok: true };
}

export function canCheckoutTokenPack(topUpEnabled: boolean):
  | {
      ok: true;
    }
  | { ok: false; reason: CheckoutRefusal } {
  if (!topUpEnabled) return { ok: false, reason: "top_up_disabled" };
  return { ok: true };
}

export function purchasedDebtBlocksAi(purchasedRemaining: number): boolean {
  return purchasedRemaining < 0;
}

export function availableAiTokens(input: {
  monthlyRemaining: number;
  giftedRemaining: number;
  purchasedRemaining: number;
}): number {
  if (purchasedDebtBlocksAi(input.purchasedRemaining)) return 0;
  return (
    input.monthlyRemaining + input.giftedRemaining + input.purchasedRemaining
  );
}
