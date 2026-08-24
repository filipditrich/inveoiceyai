import { DashboardBalanceRow } from "@/components/dashboard/dashboard-balance";
import { DashboardIssuerFilter } from "@/components/dashboard/dashboard-issuer-filter";
import { DashboardGettingStarted } from "@/components/dashboard/dashboard-getting-started";
import { DashboardMonthlyChart } from "@/components/dashboard/dashboard-monthly-chart";
import { DashboardRecentInvoices } from "@/components/dashboard/dashboard-recent-invoices";
import { DashboardStatusCards } from "@/components/dashboard/dashboard-status-cards";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { loadDashboardMetrics } from "@/lib/dashboard-metrics";
import { loadIssuerOptions } from "@/lib/load-parties";
import { requireWorkspace } from "@/lib/auth/session";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChartNoAxesCombinedIcon } from "lucide-react";

type Search = Promise<{ issuerId?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const [t, { workspaceId }, sp] = await Promise.all([
    getTranslations("Dashboard"),
    requireWorkspace(),
    searchParams,
  ]);
  const issuerId = sp.issuerId?.trim() || undefined;
  const [issuers, metrics] = await Promise.all([
    loadIssuerOptions(workspaceId),
    loadDashboardMetrics(workspaceId, { issuerId }),
  ]);

  if (metrics.issuerCount === 0) {
    return (
      <div className="flex flex-1 flex-col py-6">
        <PageHeader
          actions={
            <Button render={<Link href="/welcome" prefetch />} size="sm">
              {t("empty.cta")}
            </Button>
          }
          description={t("empty.description")}
          icon={<ChartNoAxesCombinedIcon />}
          title={t("empty.title")}
        />
      </div>
    );
  }

  const hasInvoices = metrics.buckets.some((bucket) => bucket.count > 0);
  if (!issuerId && !hasInvoices) {
    return (
      <div className="flex flex-1 flex-col py-6">
        <DashboardGettingStarted />
      </div>
    );
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <PageHeader
          actions={
            <>
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
            </>
          }
          description={t("subtitle")}
          filters={
            <DashboardIssuerFilter issuers={issuers} selectedId={issuerId} />
          }
          icon={<ChartNoAxesCombinedIcon />}
          title={t("title")}
        />
      </div>
      <DashboardStatusCards buckets={metrics.buckets} issuerId={issuerId} />
      <DashboardBalanceRow balance={metrics.balance} />
      <DashboardMonthlyChart data={metrics.monthly} />
      <DashboardRecentInvoices rows={metrics.recent} />
    </div>
  );
}
