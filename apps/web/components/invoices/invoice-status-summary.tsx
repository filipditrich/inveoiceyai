import { formatMoneyByCurrency } from "@/lib/format";
import { DISPLAY_STATUS_CARD_ACCENT } from "@/lib/invoice-status-ui";
import { cn } from "@/lib/utils";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import type { InvoiceDisplayStatus } from "@invoicey/invoice-core/status-display";

import type { AppLocale } from "@/i18n/config";

export type StatusSummaryBucket = {
  status: InvoiceDisplayStatus;
  count: number;
  totalsByCurrency: Record<string, number>;
};

function hrefFor(
  status: InvoiceDisplayStatus,
  base: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (v) {
      params.set(k, v);
    }
  }
  params.set("status", status);
  params.delete("page");
  return `/invoices?${params.toString()}`;
}

export async function InvoiceStatusSummary({
  buckets,
  activeStatus,
  filterBase,
}: {
  buckets: StatusSummaryBucket[];
  activeStatus: InvoiceDisplayStatus | null;
  filterBase: Record<string, string | undefined>;
}) {
  const locale = (await getLocale()) as AppLocale;
  const tStatus = await getTranslations("Status.invoice");
  const tCount = await getTranslations("Status.invoiceCount");

  return (
    <div className="grid grid-cols-2 gap-3 @xl/main:grid-cols-3 @5xl/main:grid-cols-6">
      {buckets.map((b) => {
        const active = activeStatus === b.status;
        return (
          <Link
            className={cn(
              "rounded-md border px-3 py-3 transition-colors hover:bg-muted/40",
              active && "ring-2 ring-ring",
              b.status === "cancelled" && "opacity-80",
            )}
            href={hrefFor(b.status, filterBase)}
            key={b.status}
          >
            <div
              className={cn(
                "text-sm font-medium",
                DISPLAY_STATUS_CARD_ACCENT[b.status],
              )}
            >
              {tStatus(b.status)}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoneyByCurrency(b.totalsByCurrency, locale)}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {tCount("label", { count: b.count })}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
