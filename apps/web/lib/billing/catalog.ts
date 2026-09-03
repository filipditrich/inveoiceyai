import "server-only";
import type { BillingOfferKey } from "@invoicey/db";
import { env } from "@invoicey/env/server";

import type { PolarProductMap } from "./catalog-map";

export type PolarCatalog = {
  environment: "sandbox" | "production";
  accessToken: string;
  webhookSecret: string;
  products: PolarProductMap;
};

export {
  offerKeyForProductId,
  productIdForOffer,
  type PolarProductMap,
} from "./catalog-map";

function requiredPolarString(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required when Polar billing is enabled`);
  }
  return value;
}

/** Null when Polar is not configured. Throws if the env set is incomplete. */
export function getPolarCatalog(): PolarCatalog | null {
  if (!env.POLAR_ENVIRONMENT) return null;
  return {
    environment: env.POLAR_ENVIRONMENT,
    accessToken: requiredPolarString(
      env.POLAR_ACCESS_TOKEN,
      "POLAR_ACCESS_TOKEN",
    ),
    webhookSecret: requiredPolarString(
      env.POLAR_WEBHOOK_SECRET,
      "POLAR_WEBHOOK_SECRET",
    ),
    products: {
      pro_monthly: requiredPolarString(
        env.POLAR_PRODUCT_PRO_MONTHLY,
        "POLAR_PRODUCT_PRO_MONTHLY",
      ),
      pro_yearly: requiredPolarString(
        env.POLAR_PRODUCT_PRO_YEARLY,
        "POLAR_PRODUCT_PRO_YEARLY",
      ),
      tokens_small: requiredPolarString(
        env.POLAR_PRODUCT_TOKENS_SMALL,
        "POLAR_PRODUCT_TOKENS_SMALL",
      ),
      tokens_medium: requiredPolarString(
        env.POLAR_PRODUCT_TOKENS_MEDIUM,
        "POLAR_PRODUCT_TOKENS_MEDIUM",
      ),
      tokens_large: requiredPolarString(
        env.POLAR_PRODUCT_TOKENS_LARGE,
        "POLAR_PRODUCT_TOKENS_LARGE",
      ),
    } satisfies Record<BillingOfferKey, string>,
  };
}
