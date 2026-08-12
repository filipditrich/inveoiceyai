import type { StatusBucket } from "@/lib/dashboard-metrics";
import { DISPLAY_STATUS_CARD_ACCENT } from "@/lib/invoice-status-ui";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AppLocale } from "@/i18n/config";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

function hrefFor(status: StatusBucket["status"], issuerId?: string): string {
  const params = new URLSearchParams({ status });
  if (issuerId) {
    params.set("issuerId", issuerId);
  }
  return `/invoices?${params.toString()}`;
}

function formatBucketTotals(
  totalsByCurrency: Record<string, number>,
  locale: AppLocale,
): string {
  const entries = Object.entries(totalsByCurrency);
  if (entries.length === 0) {
    return formatMoney(0, "CZK", locale);
  }
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, total]) => formatMoney(total, currency, locale))
    .join(" · ");
}

export async function DashboardStatusCards({
  buckets,
  issuerId,
}: {
  buckets: StatusBucket[];
  issuerId?: string;
}) {
  const tStatus = await getTranslations("Status.invoice");
  const tCount = await getTranslations("Status.invoiceCount");
  const locale = (await getLocale()) as AppLocale;

  return (
    <div className="@xl/main:grid-cols-2 @5xl/main:grid-cols-5 grid grid-cols-1 gap-4 px-4 lg:px-6">
      {buckets.map((b) => (
        <Link
          className="block transition-opacity hover:opacity-90"
          href={hrefFor(b.status, issuerId)}
          key={b.status}
        >
          <Card className="@container/card h-full">
            <CardHeader>
              <CardDescription
                className={cn(DISPLAY_STATUS_CARD_ACCENT[b.status])}
              >
                {tStatus(b.status)}
              </CardDescription>
              <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
                {formatBucketTotals(b.totalsByCurrency, locale)}
              </CardTitle>
            </CardHeader>
            <CardFooter className="text-muted-foreground text-sm tabular-nums">
              {tCount("label", { count: b.count })}
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  );
}
