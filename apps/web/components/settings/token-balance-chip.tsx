"use client";

import { formatTokenCount } from "@/lib/ai/format-tokens";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSidebar } from "@/components/ui/sidebar";
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
          "text-muted-foreground hover:text-foreground inline-flex items-center transition-colors",
          collapsed
            ? "hover:bg-sidebar-accent size-8 justify-center rounded-md"
            : "bg-brand/5 hover:bg-brand/10 w-full gap-2 rounded-lg px-2.5 py-2 text-left",
        )}
        aria-label={t("title")}
      >
        <SparklesIcon className="text-brand size-3.5 shrink-0" />
        {collapsed ? null : (
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2 text-xs tabular-nums">
              <span className="truncate">{t("title")}</span>
              <span className="text-foreground font-medium">
                {t("remaining", { count: formatTokenCount(totalAvailable) })}
              </span>
            </span>
            <span
              className="bg-foreground/10 mt-1.5 block h-1 overflow-hidden rounded-full"
              title={t("monthlyUsed")}
            >
              <span
                className="bg-brand/70 block h-full rounded-full"
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
            href="/settings/usage"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "w-full",
            )}
          >
            {t("viewUsage")}
          </Link>
          <Button type="button" size="sm" className="w-full" disabled>
            {t("upgrade")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
