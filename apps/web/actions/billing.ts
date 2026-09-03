"use server";

import { ForbiddenError } from "@/lib/auth/errors";
import { requireSession, requireWorkspace } from "@/lib/auth/session";
import { assertCan } from "@/lib/authz/can";
import { getPolarCatalog } from "@/lib/billing/catalog";
import { productIdForOffer } from "@/lib/billing/catalog-map";
import { getPolarClient } from "@/lib/billing/polar-client";
import { getLocale } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  canCheckoutPlanOffer,
  canCheckoutTokenPack,
  getWorkspaceEntitlements,
  isPlanOffer,
  isTokenPackOffer,
  type BillingOfferKey,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

export type BillingActionErrorCode =
  | "not_configured"
  | "forbidden"
  | "unknown_offer"
  | "custom_plan"
  | "enterprise"
  | "top_up_disabled"
  | "checkout_failed"
  | "portal_failed";

export type BillingActionResult =
  | { ok: true }
  | { ok: false; errorCode: BillingActionErrorCode };

function trustedClientIp(headerList: Headers): string | undefined {
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headerList.get("x-real-ip")?.trim() || undefined;
}

async function requireBillingManager(): Promise<{
  workspaceId: string;
  user: Awaited<ReturnType<typeof requireSession>>;
}> {
  const [user, { workspaceId }] = await Promise.all([
    requireSession(),
    requireWorkspace(),
  ]);
  await assertCan("billing:manage");
  return { workspaceId, user };
}

export async function startBillingCheckoutAction(
  offerKey: BillingOfferKey,
): Promise<BillingActionResult> {
  let checkoutUrl: string;
  try {
    const { workspaceId, user } = await requireBillingManager();
    const catalog = getPolarCatalog();
    if (!catalog) return { ok: false, errorCode: "not_configured" };

    const productId = productIdForOffer(catalog.products, offerKey);
    if (!productId) return { ok: false, errorCode: "unknown_offer" };

    const entitlements = await getWorkspaceEntitlements(db, workspaceId);
    if (!entitlements) return { ok: false, errorCode: "checkout_failed" };

    if (isPlanOffer(offerKey)) {
      const allowed = canCheckoutPlanOffer({
        planKind: entitlements.planKind,
        planKey: entitlements.planKey,
      });
      if (!allowed.ok) return { ok: false, errorCode: allowed.reason };
    } else if (isTokenPackOffer(offerKey)) {
      const allowed = canCheckoutTokenPack(
        entitlements.entitlements.ai.topUpEnabled,
      );
      if (!allowed.ok) return { ok: false, errorCode: allowed.reason };
    } else {
      return { ok: false, errorCode: "unknown_offer" };
    }

    const headerList = await headers();
    const locale = await getLocale();
    const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const polar = getPolarClient(catalog);
    const checkout = await polar.checkouts.create({
      products: [productId],
      externalCustomerId: workspaceId,
      customerEmail: user.email,
      customerName: user.name,
      isBusinessCustomer: true,
      customerIpAddress: trustedClientIp(headerList),
      locale: locale === "cs" ? "cs" : "en",
      successUrl: `${appUrl}/settings/workspace/billing/return?checkout_id={CHECKOUT_ID}`,
      returnUrl: `${appUrl}/settings/workspace/billing`,
      metadata: {
        invoicey_offer_key: offerKey,
        invoicey_workspace_id: workspaceId,
      },
    });
    checkoutUrl = checkout.url;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, errorCode: "forbidden" };
    }
    console.error("[billing] checkout failed", error);
    return { ok: false, errorCode: "checkout_failed" };
  }

  redirect(checkoutUrl);
}

export async function openBillingPortalAction(): Promise<BillingActionResult> {
  let portalUrl: string;
  try {
    const { workspaceId } = await requireBillingManager();
    const catalog = getPolarCatalog();
    if (!catalog) return { ok: false, errorCode: "not_configured" };

    const polar = getPolarClient(catalog);
    const session = await polar.customerSessions.create({
      externalCustomerId: workspaceId,
      returnUrl: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/settings/workspace/billing`,
    });
    portalUrl = session.customerPortalUrl;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, errorCode: "forbidden" };
    }
    console.error("[billing] portal failed", error);
    return { ok: false, errorCode: "portal_failed" };
  }

  redirect(portalUrl);
}
