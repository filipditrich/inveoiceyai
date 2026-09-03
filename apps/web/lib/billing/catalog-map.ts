import {
  BILLING_OFFER_KEYS,
  isBillingOfferKey,
  type BillingOfferKey,
} from "@invoicey/db";

export type PolarProductMap = Record<BillingOfferKey, string>;

export function offerKeyForProductId(
  products: PolarProductMap,
  productId: string,
): BillingOfferKey | null {
  for (const key of BILLING_OFFER_KEYS) {
    if (products[key] === productId) return key;
  }
  return null;
}

export function productIdForOffer(
  products: PolarProductMap,
  offerKey: string,
): string | null {
  if (!isBillingOfferKey(offerKey)) return null;
  return products[offerKey];
}
