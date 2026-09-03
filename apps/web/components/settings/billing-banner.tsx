"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function BillingBanner({
  pastDue,
  canceling,
}: {
  pastDue: boolean;
  canceling: boolean;
}) {
  const t = useTranslations("App.settings.billing.banner");
  if (!pastDue && !canceling) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <p className="text-sm">{pastDue ? t("pastDue") : t("canceling")}</p>
      <Button render={<Link href="/settings/workspace/billing" />} size="sm">
        {t("cta")}
      </Button>
    </div>
  );
}
