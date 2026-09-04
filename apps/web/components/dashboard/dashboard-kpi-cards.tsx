import { isAppLocale } from "@/i18n/config";
import {
  invoicesListHref,
  type InvoiceListParams,
} from "@/lib/dashboard-attention";
import { formatMoneyByCurrency } from "@/lib/format";
import { DISPLAY_STATUS_CARD_ACCENT } from "@/lib/invoice-status-ui";
import { cn } from "@/lib/utils";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import type { DashboardBalance, StatusBucket } from "@/lib/dashboard-metrics";
import type { DashboardPeriodWindow } from "@/lib/dashboard-period";

function periodParams(
  periodWindow: DashboardPeriodWindow,
  issuerId?: string,
): InvoiceListParams {
  return { from: periodWindow.from, to: periodWindow.to, issuerId };
}

export async function DashboardKpiCards({
  buckets,
  balance,
  periodWindow,
  issuerId,
}: {
  buckets: StatusBucket[];
  balance: DashboardBalance;
  periodWindow: DashboardPeriodWindow;
  issuerId?: string;
}) {
  const tStatus = await getTranslations("Status.invoice");
  const tKpi = await getTranslations("Dashboard.kpi");
  const tCount = await getTranslations("Status.invoiceCount");
  const localeValue = await getLocale();
  const locale = isAppLocale(localeValue) ? localeValue : "cs";
  const range = periodParams(periodWindow, issuerId);
  const issuedTotals: Record<string, number> = {};
  const outstandingTotals: Record<string, number> = {};
  for (const row of balance.byCurrency) {
    issuedTotals[row.currency] = row.issuedVolume;
    outstandingTotals[row.currency] = row.outstanding;
  }

  const cards = [
    ...buckets.map((bucket) => ({
      key: bucket.status,
      label: tStatus(bucket.status),
      href: invoicesListHref({ ...range, status: bucket.status }),
      totals: bucket.totalsByCurrency,
      count: bucket.count,
      accent: DISPLAY_STATUS_CARD_ACCENT[bucket.status],
    })),
    {
      key: "issued",
      label: tKpi("issued"),
      href: invoicesListHref(range),
      totals: issuedTotals,
      count: balance.issuedCount,
      accent: "text-muted-foreground",
    },
    {
      key: "outstanding",
      label: tKpi("outstanding"),
      href: invoicesListHref({ ...range, status: "unpaid" }),
      totals: outstandingTotals,
      count: balance.outstandingCount,
      accent: DISPLAY_STATUS_CARD_ACCENT.unpaid,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 @3xl/main:grid-cols-4 @6xl/main:grid-cols-7">
      {cards.map((card) => (
        <Link
          className="rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40"
          href={card.href}
          key={card.key}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn("text-sm font-medium", card.accent)}>
              {card.label}
            </span>
            <span
              className="text-xs text-muted-foreground tabular-nums"
              title={tCount("label", { count: card.count })}
            >
              {card.count}
            </span>
          </div>
          <div className="mt-1 text-lg font-semibold tracking-tight tabular-nums">
            {formatMoneyByCurrency(card.totals, locale)}
          </div>
        </Link>
      ))}
    </div>
  );
}
