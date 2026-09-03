import { describe, expect, it } from "vitest";

import { BILLING_OFFER_KEYS } from "@invoicey/db";

import { offerKeyForProductId, productIdForOffer } from "./catalog-map";

const products = {
  pro_monthly: "prod_month",
  pro_yearly: "prod_year",
  tokens_small: "prod_s",
  tokens_medium: "prod_m",
  tokens_large: "prod_l",
};

describe("polar catalog map", () => {
  it("maps every launch offer both ways", () => {
    for (const key of BILLING_OFFER_KEYS) {
      const productId = productIdForOffer(products, key);
      expect(productId).toBeTruthy();
      expect(offerKeyForProductId(products, productId!)).toBe(key);
    }
  });

  it("rejects unknown product ids and offer keys", () => {
    expect(offerKeyForProductId(products, "prod_other")).toBeNull();
    expect(productIdForOffer(products, "enterprise")).toBeNull();
  });
});
