"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSidebar } from "@/components/ui/sidebar";
import { formatTokenCount } from "@/lib/ai/format-tokens";
import { cn } from "@/lib/utils";
import { SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export type TokenBalanceChipProps = {
  giftedRemaining: number;
  monthlyRemaining: number;
  purchasedRemaining: number;
  totalAvailable: number;
  monthlyLimit: number;
};

export function TokenBalanceChip({
  giftedRemaining,
  monthlyRemaining,
  purchasedRemaining,
  totalAvailable,
  monthlyLimit,
}: TokenBalanceChipProps) {
  const t = useTranslations("App.settings.usage.chip");
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const usedRatio =
    monthlyLimit > 0
      ? Math.min(
          1,
          Math.max(0, (monthlyLimit - monthlyRemaining) / monthlyLimit),
        )
      : 0;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center text-muted-foreground transition-colors hover:text-foreground",
          collapsed
            ? "size-8 justify-center rounded-md hover:bg-sidebar-accent"
            : "w-full gap-2 rounded-lg bg-brand/5 px-2.5 py-2 text-left hover:bg-brand/10",
        )}
        aria-label={t("title")}
      >
        <SparklesIcon className="size-3.5 shrink-0 text-brand" />
        {collapsed ? null : (
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2 text-xs tabular-nums">
              <span className="truncate">{t("title")}</span>
              <span className="font-medium text-foreground">
                {t("remaining", { count: formatTokenCount(totalAvailable) })}
              </span>
            </span>
            <span
              className="mt-1.5 block h-1 overflow-hidden rounded-full bg-foreground/10"
              title={t("monthlyUsed")}
            >
              <span
                className="block h-full rounded-full bg-brand/70"
                style={{ width: `${Math.round(usedRatio * 100)}%` }}
              />
            </span>
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0" side="top">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">{t("title")}</p>
        </div>
        <dl className="space-y-2 px-4 py-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("gifted")}</dt>
            <dd className="tabular-nums">
              {formatTokenCount(giftedRemaining)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("monthly")}</dt>
            <dd className="tabular-nums">
              {formatTokenCount(monthlyRemaining)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("purchased")}</dt>
            <dd className="tabular-nums">
              {formatTokenCount(purchasedRemaining)}
            </dd>
          </div>
        </dl>
        <div className="flex flex-col gap-2 border-t p-3">
          <Link
            href="/settings/workspace/usage"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "w-full",
            )}
          >
            {t("viewUsage")}
          </Link>
          <Link
            href="/settings/workspace/billing"
            className={cn(buttonVariants({ size: "sm" }), "w-full")}
          >
            {t("upgrade")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
