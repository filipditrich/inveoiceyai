import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoneyByCurrency } from "@/lib/format";
import { DISPLAY_STATUS_CARD_ACCENT } from "@/lib/invoice-status-ui";
import { cn } from "@/lib/utils";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import type { AppLocale } from "@/i18n/config";
import type { StatusBucket } from "@/lib/dashboard-metrics";

function hrefFor(status: StatusBucket["status"], issuerId?: string): string {
  const params = new URLSearchParams({ status });
  if (issuerId) {
    params.set("issuerId", issuerId);
  }
  return `/invoices?${params.toString()}`;
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
    <div className="grid grid-cols-2 gap-3 sm:gap-4 @5xl/main:grid-cols-5">
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
              <CardTitle className="text-xl font-semibold tabular-nums @[180px]/card:text-2xl @[250px]/card:text-3xl">
                {formatMoneyByCurrency(b.totalsByCurrency, locale)}
              </CardTitle>
            </CardHeader>
            <CardFooter className="text-sm text-muted-foreground tabular-nums">
              {tCount("label", { count: b.count })}
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  );
}
