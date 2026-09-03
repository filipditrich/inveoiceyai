"use client";

import { useTransition } from "react";
import {
  openBillingPortalAction,
  startBillingCheckoutAction,
  type BillingActionErrorCode,
} from "@/actions/billing";
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
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  BILLING_OFFER_CURRENCY,
  BILLING_OFFER_PRICES,
  TOKEN_PACK_AMOUNTS,
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

const PLAN_OFFERS: BillingOfferKey[] = ["pro_monthly", "pro_yearly"];
const TOKEN_OFFERS = [
  "tokens_small",
  "tokens_medium",
  "tokens_large",
] as const satisfies ReadonlyArray<keyof typeof TOKEN_PACK_AMOUNTS>;

export function BillingPanels({ state }: { state: BillingPageState }) {
  const t = useTranslations("App.settings.billing");
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const [pending, startTransition] = useTransition();

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

  const planCheckoutAllowed =
    state.planKey !== "enterprise" && state.planKey !== "nfctron";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{t("plan.title")}</CardTitle>
              <CardDescription>{t("plan.subtitle")}</CardDescription>
            </div>
            {state.canManage && state.authority === "polar" ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending || !state.configured}
                onClick={openPortal}
              >
                {t("plan.manage")}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div>
            <p className="text-lg font-medium">{state.planName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {state.authority === "polar"
                ? t("plan.polarManaged")
                : t("plan.manualManaged")}
            </p>
            {state.subscriptionStatus ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("plan.status", { status: state.subscriptionStatus })}
                {state.periodEndIso
                  ? ` · ${t("plan.periodEnd", {
                      date: format.dateTime(new Date(state.periodEndIso), {
                        dateStyle: "medium",
                      }),
                    })}`
                  : null}
              </p>
            ) : null}
            {state.pastDue ? (
              <p className="mt-2 text-sm text-foreground">
                {t("banner.pastDue")}
              </p>
            ) : null}
            {state.canceling ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("banner.canceling")}
              </p>
            ) : null}
          </div>
          {state.canManage && planCheckoutAllowed ? (
            <div className="flex flex-wrap items-center gap-2">
              {PLAN_OFFERS.map((offer) => (
                <Button
                  key={offer}
                  type="button"
                  disabled={pending || !state.configured}
                  variant={offer === "pro_yearly" ? "default" : "outline"}
                  onClick={() => checkout(offer)}
                >
                  {t(`offers.${offer}`)}
                  <span className="tabular-nums opacity-80">
                    {offerPrice(offer)}
                  </span>
                </Button>
              ))}
            </div>
          ) : null}
          {!state.configured ? (
            <p className="text-xs text-muted-foreground">
              {t("notConfigured")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {state.topUpEnabled ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{t("packs.title")}</CardTitle>
            <CardDescription>{t("packs.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-5 sm:grid-cols-3">
            {TOKEN_OFFERS.map((offer) => (
              <div
                key={offer}
                className="flex flex-col justify-between rounded-xl border p-4"
              >
                <div>
                  <p className="text-sm font-medium">{t(`offers.${offer}`)}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {offerPrice(offer)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatTokenCount(TOKEN_PACK_AMOUNTS[offer])}
                  </p>
                </div>
                <Button
                  type="button"
                  className="mt-4"
                  disabled={pending || !state.configured || !state.canManage}
                  onClick={() => checkout(offer)}
                >
                  {t("packs.buy")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
