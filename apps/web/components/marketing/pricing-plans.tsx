import { Button } from "@/components/ui/button";
import { formatCatalogMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { BILLING_OFFER_CURRENCY, BILLING_OFFER_PRICES } from "@invoicey/db";

import { MARKETING_PILL_LG_CLASS } from "./marketing-cta";
import type { AppLocale } from "@/i18n/config";

/**
 * The three public plans. The sponsored NFCtron plan is a custom row in the
 * database and is deliberately absent here. Feature keys are spelled out
 * because the message catalog is statically typed.
 *
 * Token packs stay in workspace Billing / AI usage — not on this page.
 */
const PLANS = [
  {
    features: [
      "freeFeature1",
      "freeFeature2",
      "freeFeature3",
      "freeFeature4",
      "freeFeature5",
      "freeFeature6",
    ],
    href: "/dashboard",
    id: "free",
  },
  {
    features: [
      "proFeature1",
      "proFeature2",
      "proFeature3",
      "proFeature4",
      "proFeature5",
    ],
    href: "/settings/workspace/billing",
    id: "pro",
  },
  {
    features: [
      "enterpriseFeature1",
      "enterpriseFeature2",
      "enterpriseFeature3",
      "enterpriseFeature4",
      "enterpriseFeature5",
    ],
    href: "mailto:hello@invoicey.app",
    id: "enterprise",
  },
] as const;

export async function PricingPlans({
  signedIn,
}: Readonly<{ signedIn: boolean }>) {
  const t = await getTranslations("Marketing.pricing");
  const locale = (await getLocale()) as AppLocale;
  const money = (amount: number) =>
    formatCatalogMoney(amount, BILLING_OFFER_CURRENCY, locale);

  return (
    <div className="mt-14 grid items-stretch gap-5 pt-3 lg:grid-cols-3 lg:[grid-template-rows:auto_auto_auto_auto_auto_1fr]">
      {PLANS.map((plan) => {
        const featured = plan.id === "pro";
        const external = plan.href.startsWith("mailto:");
        const href =
          plan.id === "pro" && !signedIn
            ? `/sign-in?next=${encodeURIComponent(plan.href)}`
            : plan.href;
        const price =
          plan.id === "free"
            ? money(0)
            : plan.id === "pro"
              ? money(BILLING_OFFER_PRICES.pro_monthly)
              : t("enterprisePrice");
        return (
          <div
            key={plan.id}
            className={cn(
              "relative flex h-full flex-col rounded-3xl border bg-card p-7 sm:p-8",
              "lg:row-span-6 lg:grid lg:grid-rows-subgrid lg:gap-0",
              featured && "border-primary/40 shadow-lg shadow-primary/10",
            )}
          >
            {featured ? (
              <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-[0.65rem] font-semibold tracking-wide text-brand-foreground uppercase">
                {t("betaBadge")}
              </span>
            ) : null}
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              {t(`${plan.id}Name`)}
            </p>
            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold tracking-[-0.04em] tabular-nums">
                {price}
              </span>
              {plan.id === "enterprise" ? null : (
                <span className="text-sm text-muted-foreground">
                  {t(`${plan.id}Period`)}
                </span>
              )}
            </p>
            <p className="mt-1 min-h-5 text-sm text-muted-foreground">
              {plan.id === "pro"
                ? t("proYearly", {
                    price: money(BILLING_OFFER_PRICES.pro_yearly),
                  })
                : null}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t(`${plan.id}Description`)}
            </p>
            <Button
              size="lg"
              variant={featured ? "default" : "outline"}
              className={`mt-7 h-11 w-full text-[0.95rem] ${MARKETING_PILL_LG_CLASS}`}
              render={
                external ? (
                  <a href={href} />
                ) : (
                  <Link href={href} prefetch={false} />
                )
              }
            >
              {signedIn && !external
                ? t(`${plan.id}CtaSignedIn`)
                : t(`${plan.id}Cta`)}
              {external ? null : <ArrowRightIcon data-icon="inline-end" />}
            </Button>
            <div className="mt-8 flex min-h-0 flex-1 flex-col">
              <p className="text-xs font-medium text-muted-foreground">
                {t(`${plan.id}IncludesLabel`)}
              </p>
              <ul className="mt-3 flex-1 space-y-2.5 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                    {t(feature)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
