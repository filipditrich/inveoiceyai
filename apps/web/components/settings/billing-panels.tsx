"use client";

import { useTransition } from "react";
import {
  openBillingPortalAction,
  startBillingCheckoutAction,
  type BillingActionErrorCode,
} from "@/actions/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatTokenCount } from "@/lib/ai/format-tokens";
import { formatCatalogMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  BILLING_OFFER_CURRENCY,
  BILLING_OFFER_PRICES,
  TOKEN_PACK_AMOUNTS,
  isProjectedPolarSubscription,
  type BillingOfferKey,
} from "@invoicey/db";

import type { AppLocale } from "@/i18n/config";

export type BillingPageState = {
  configured: boolean;
  canManage: boolean;
  topUpEnabled: boolean;
  planName: string;
  planKey: string;
  authority: "manual" | "polar";
  subscriptionStatus: string | null;
  canceling: boolean;
  pastDue: boolean;
  periodEndIso: string | null;
};

const PLAN_OFFERS = [
  "pro_monthly",
  "pro_yearly",
] as const satisfies ReadonlyArray<BillingOfferKey>;

const TOKEN_OFFERS = [
  "tokens_small",
  "tokens_medium",
  "tokens_large",
] as const satisfies ReadonlyArray<keyof typeof TOKEN_PACK_AMOUNTS>;

const PRO_FEATURES = ["proFeature1", "proFeature2", "proFeature3"] as const;

function currentPlanCopyKey(
  planKey: string,
): "free" | "pro" | "enterprise" | "nfctron" {
  if (planKey === "pro" || planKey === "enterprise" || planKey === "nfctron") {
    return planKey;
  }
  return "free";
}

export function BillingPanels({ state }: { state: BillingPageState }) {
  const t = useTranslations("App.settings.billing");
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const [pending, startTransition] = useTransition();

  const subscribed = isProjectedPolarSubscription({
    authority: state.authority,
    status: state.subscriptionStatus,
  });
  const customPlan =
    state.planKey === "enterprise" || state.planKey === "nfctron";
  const currentKey = currentPlanCopyKey(state.planKey);

  const offerPrice = (offerKey: BillingOfferKey) =>
    formatCatalogMoney(
      BILLING_OFFER_PRICES[offerKey],
      BILLING_OFFER_CURRENCY,
      locale,
    );

  const showError = (errorCode: BillingActionErrorCode) => {
    toast.error(t(`errors.${errorCode}`));
  };

  const checkout = (offerKey: BillingOfferKey) => {
    startTransition(async () => {
      const result = await startBillingCheckoutAction(offerKey);
      if (result && !result.ok) showError(result.errorCode);
    });
  };

  const openPortal = () => {
    startTransition(async () => {
      const result = await openBillingPortalAction();
      if (result && !result.ok) showError(result.errorCode);
    });
  };

  const checkoutReady = state.canManage && state.configured && !pending;

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3 border-b">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">{t("plan.title")}</CardTitle>
            <CardDescription>{t("plan.subtitle")}</CardDescription>
          </div>
          {state.canManage && subscribed ? (
            <Button
              type="button"
              variant="outline"
              disabled={!state.configured || pending}
              onClick={openPortal}
            >
              {t("plan.manage")}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-semibold tracking-tight">
              {state.planName}
            </p>
            <Badge variant={subscribed ? "default" : "secondary"}>
              {subscribed ? t("plan.subscribed") : t("plan.workspacePlan")}
            </Badge>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t(`plan.current.${currentKey}`)}
          </p>
          {subscribed && state.periodEndIso ? (
            <p className="text-sm text-muted-foreground">
              {t(state.canceling ? "plan.ends" : "plan.renews", {
                date: format.dateTime(new Date(state.periodEndIso), {
                  dateStyle: "medium",
                }),
              })}
            </p>
          ) : null}
          {state.pastDue ? (
            <p className="text-sm">{t("banner.pastDue")}</p>
          ) : null}
          {state.canceling && !state.pastDue ? (
            <p className="text-sm text-muted-foreground">
              {t("banner.canceling")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {customPlan ? (
        <p className="text-sm text-muted-foreground">{t("plan.customNote")}</p>
      ) : (
        <section className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold tracking-tight">
              {t("offers.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("offers.subtitle")}
            </p>
          </div>
          <div className="grid items-stretch gap-4 lg:grid-cols-2">
            {PLAN_OFFERS.map((offer) => {
              const featured = offer === "pro_yearly";
              return (
                <div
                  key={offer}
                  className={cn(
                    "flex flex-col rounded-2xl border bg-card p-6",
                    featured && "border-primary/40 shadow-sm shadow-primary/5",
                  )}
                >
                  <p className="text-sm font-semibold tracking-wide text-primary uppercase">
                    {t(`offers.${offer}`)}
                  </p>
                  <p className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-3xl font-semibold tracking-[-0.03em] tabular-nums">
                      {offerPrice(offer)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t(`offers.period.${offer}`)}
                    </span>
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {t(`offers.blurb.${offer}`)}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2 text-sm">
                    {PRO_FEATURES.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                        {t(`offers.features.${feature}`)}
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    className="mt-6 w-full"
                    variant={featured ? "default" : "outline"}
                    disabled={!checkoutReady}
                    onClick={() => checkout(offer)}
                  >
                    {subscribed ? t("offers.switch") : t("offers.cta")}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {state.topUpEnabled ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold tracking-tight">
              {t("packs.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("packs.subtitle")}
            </p>
          </div>
          <div className="grid items-stretch gap-4 sm:grid-cols-3">
            {TOKEN_OFFERS.map((offer) => (
              <div
                key={offer}
                className="flex flex-col justify-between rounded-2xl border bg-card p-6"
              >
                <div>
                  <p className="text-sm font-medium">{t(`offers.${offer}`)}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] tabular-nums">
                    {offerPrice(offer)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatTokenCount(TOKEN_PACK_AMOUNTS[offer])}
                  </p>
                </div>
                <Button
                  type="button"
                  className="mt-6 w-full"
                  variant="outline"
                  disabled={!checkoutReady}
                  onClick={() => checkout(offer)}
                >
                  {t("packs.buy")}
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("packs.tax")}</p>
        </section>
      ) : null}

      {!state.configured ? (
        <p className="text-xs text-muted-foreground">{t("notConfigured")}</p>
      ) : null}
    </div>
  );
}
