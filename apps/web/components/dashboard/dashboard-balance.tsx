import type { DashboardBalance } from "@/lib/dashboard-metrics";
import type { AppLocale } from "@/i18n/config";
import { formatMoney } from "@/lib/format";
import { getLocale, getTranslations } from "next-intl/server";

export async function DashboardBalanceRow({
  balance,
}: {
  balance: DashboardBalance;
}) {
  const t = await getTranslations("Dashboard.balance");
  const tCount = await getTranslations("Status.invoiceCount");
  const locale = (await getLocale()) as AppLocale;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-md border px-4 py-3">
        <div className="text-muted-foreground text-sm">{t("issued12m")}</div>
        <div className="mt-1 space-y-0.5 text-2xl font-semibold tabular-nums">
          {balance.byCurrency.map((row) => (
            <div key={row.currency}>
              {formatMoney(row.issuedVolume12m, row.currency, locale)}
            </div>
          ))}
        </div>
        <div className="text-muted-foreground text-xs tabular-nums">
          {tCount("label", { count: balance.issuedCount12m })}
        </div>
      </div>
      <div className="rounded-md border px-4 py-3">
        <div className="text-muted-foreground text-sm">{t("outstanding")}</div>
        <div className="mt-1 space-y-0.5 text-2xl font-semibold tabular-nums text-orange-700 dark:text-orange-400">
          {balance.byCurrency.map((row) => (
            <div key={row.currency}>
              {formatMoney(row.outstanding, row.currency, locale)}
            </div>
          ))}
        </div>
        <div className="text-muted-foreground text-xs tabular-nums">
          {tCount("label", { count: balance.outstandingCount })}
        </div>
      </div>
    </div>
  );
}
