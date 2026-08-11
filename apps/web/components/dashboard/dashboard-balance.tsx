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
    <div className="grid gap-4 px-4 sm:grid-cols-2 lg:px-6">
      <div className="rounded-md border px-4 py-3">
        <div className="text-muted-foreground text-sm">{t("issued12m")}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">
          {formatMoney(balance.issuedVolume12m, "CZK", locale)}
        </div>
        <div className="text-muted-foreground text-xs tabular-nums">
          {tCount("label", { count: balance.issuedCount12m })}
        </div>
      </div>
      <div className="rounded-md border px-4 py-3">
        <div className="text-muted-foreground text-sm">{t("outstanding")}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-orange-700 dark:text-orange-400">
          {formatMoney(balance.outstanding, "CZK", locale)}
        </div>
        <div className="text-muted-foreground text-xs tabular-nums">
          {tCount("label", { count: balance.outstandingCount })}
        </div>
      </div>
    </div>
  );
}
