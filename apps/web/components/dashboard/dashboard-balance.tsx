import { formatMoney } from "@/lib/format";
import { getLocale, getTranslations } from "next-intl/server";

import type { AppLocale } from "@/i18n/config";
import type { DashboardBalance } from "@/lib/dashboard-metrics";

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
        <div className="text-sm text-muted-foreground">{t("issued12m")}</div>
        <div className="mt-1 space-y-0.5 text-2xl font-semibold tabular-nums">
          {balance.byCurrency.map((row) => (
            <div key={row.currency}>
              {formatMoney(row.issuedVolume12m, row.currency, locale)}
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {tCount("label", { count: balance.issuedCount12m })}
        </div>
      </div>
      <div className="rounded-md border px-4 py-3">
        <div className="text-sm text-muted-foreground">{t("outstanding")}</div>
        <div className="mt-1 space-y-0.5 text-2xl font-semibold text-orange-700 tabular-nums dark:text-orange-400">
          {balance.byCurrency.map((row) => (
            <div key={row.currency}>
              {formatMoney(row.outstanding, row.currency, locale)}
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {tCount("label", { count: balance.outstandingCount })}
        </div>
      </div>
    </div>
  );
}
