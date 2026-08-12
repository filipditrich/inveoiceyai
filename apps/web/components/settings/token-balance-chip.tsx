"use client";

import { formatTokenCount } from "@/lib/ai/format-tokens";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import Link from "next/link";

export type TokenBalanceChipProps = {
  giftedRemaining: number;
  monthlyRemaining: number;
  purchasedRemaining: number;
  totalAvailable: number;
};

export function TokenBalanceChip({
  giftedRemaining,
  monthlyRemaining,
  purchasedRemaining,
  totalAvailable,
}: TokenBalanceChipProps) {
  const t = useTranslations("App.settings.usage.chip");

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "text-muted-foreground hover:text-foreground hover:bg-muted/60 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs tabular-nums transition-colors",
        )}
      >
        <span className="bg-foreground/10 size-1.5 rounded-full" />
        {formatTokenCount(totalAvailable)}
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
