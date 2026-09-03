import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

/**
 * The three public plans. The sponsored NFCtron plan is a custom row in the
 * database and is deliberately absent here. Feature keys are spelled out
 * because the message catalog is statically typed.
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
    href: "/dashboard",
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

  return (
    <>
      <div className="mt-14 grid items-start gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const featured = plan.id === "pro";
          const external = plan.href.startsWith("mailto:");
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-3xl border bg-card p-7 sm:p-8",
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
                <span className="text-4xl font-semibold tracking-[-0.04em]">
                  {t(`${plan.id}Price`)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t(`${plan.id}Period`)}
                </span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t(`${plan.id}Description`)}
              </p>
              <Button
                size="lg"
                variant={featured ? "default" : "outline"}
                className="mt-7 h-11 w-full text-[0.95rem]"
                render={
                  external ? (
                    <a href={plan.href} />
                  ) : (
                    <Link href={plan.href} prefetch={false} />
                  )
                }
              >
                {signedIn && !external
                  ? t(`${plan.id}CtaSignedIn`)
                  : t(`${plan.id}Cta`)}
                {external ? null : <ArrowRightIcon data-icon="inline-end" />}
              </Button>
              <p className="mt-8 text-xs font-medium text-muted-foreground">
                {t(`${plan.id}IncludesLabel`)}
              </p>
              <ul className="mt-3 space-y-2.5 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                    {t(feature)}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-6 rounded-2xl border bg-muted/30 px-5 py-4 text-center text-sm leading-relaxed text-muted-foreground">
        {t("honestNote")}
      </p>
    </>
  );
}
