import { DashboardBalanceRow } from "@/components/dashboard/dashboard-balance";
import { DashboardIssuerFilter } from "@/components/dashboard/dashboard-issuer-filter";
import { DashboardMonthlyChart } from "@/components/dashboard/dashboard-monthly-chart";
import { DashboardRecentInvoices } from "@/components/dashboard/dashboard-recent-invoices";
import { DashboardStatusCards } from "@/components/dashboard/dashboard-status-cards";
import { Button } from "@/components/ui/button";
import { loadDashboardMetrics } from "@/lib/dashboard-metrics";
import { loadIssuerOptions } from "@/lib/load-parties";
import { requireWorkspace } from "@/lib/auth/session";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

type Search = Promise<{ issuerId?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const t = await getTranslations("Dashboard");
  const { workspaceId } = await requireWorkspace();
  const sp = await searchParams;
  const issuerId = sp.issuerId?.trim() || undefined;
  const [issuers, metrics] = await Promise.all([
    loadIssuerOptions(workspaceId),
    loadDashboardMetrics(workspaceId, { issuerId }),
  ]);

  if (metrics.issuerCount === 0) {
    return (
      <div className="flex flex-1 flex-col items-start gap-4 px-4 py-10 lg:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("empty.title")}
        </h1>
        <p className="text-muted-foreground max-w-lg">
          {t("empty.description")}
        </p>
        <Button render={<Link href="/welcome" prefetch />} size="sm">
          {t("empty.cta")}
        </Button>
      </div>
    );
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            render={<Link href="/invoices" prefetch />}
            size="sm"
            variant="outline"
          >
            {t("goToInvoices")}
          </Button>
          <Button render={<Link href="/invoices/new" prefetch />} size="sm">
            {t("newInvoice")}
          </Button>
        </div>
      </div>
      <DashboardIssuerFilter issuers={issuers} selectedId={issuerId} />
      <DashboardStatusCards buckets={metrics.buckets} issuerId={issuerId} />
      <DashboardBalanceRow balance={metrics.balance} />
      <div className="px-4 lg:px-6">
        <DashboardMonthlyChart data={metrics.monthly} />
      </div>
      <DashboardRecentInvoices rows={metrics.recent} />
    </div>
  );
}
