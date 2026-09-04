import { DashboardAttention } from "@/components/dashboard/dashboard-attention";
import { DashboardGettingStarted } from "@/components/dashboard/dashboard-getting-started";
import { DashboardIssuerFilter } from "@/components/dashboard/dashboard-issuer-filter";
import { DashboardKpiCards } from "@/components/dashboard/dashboard-kpi-cards";
import { DashboardMonthlyChart } from "@/components/dashboard/dashboard-monthly-chart";
import { DashboardPeriodFilter } from "@/components/dashboard/dashboard-period-filter";
import { DashboardRecentInvoices } from "@/components/dashboard/dashboard-recent-invoices";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import {
  loadDashboardAttention,
  loadDashboardMetrics,
} from "@/lib/dashboard-metrics";
import {
  dashboardPeriodValues,
  dashboardPeriodWindow,
  parseDashboardPeriod,
  serializeDashboardPeriod,
} from "@/lib/dashboard-period";
import { pragueTodayIso } from "@/lib/invoice-status-sql";
import { loadIssuerOptions } from "@/lib/load-parties";
import { ChartNoAxesCombinedIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

type Search = Promise<{ issuerId?: string; period?: string }>;

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
  const todayIso = pragueTodayIso();
  const period = parseDashboardPeriod(sp.period, todayIso);
  const periodWindow = dashboardPeriodWindow(period, todayIso);
  const [issuers, metrics, attention] = await Promise.all([
    loadIssuerOptions(workspaceId),
    loadDashboardMetrics(workspaceId, { issuerId, period }),
    loadDashboardAttention(workspaceId, { issuerId }),
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

  if (!issuerId && !attention.hasAnyInvoices) {
    return (
      <div className="flex flex-1 flex-col gap-6 py-6">
        <PageHeader
          description={t("subtitle")}
          icon={<ChartNoAxesCombinedIcon />}
          title={t("title")}
        />
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
            <>
              <DashboardPeriodFilter
                selected={serializeDashboardPeriod(period)}
                values={dashboardPeriodValues(
                  todayIso,
                  period.kind === "year" ? period.year : undefined,
                )}
              />
              <DashboardIssuerFilter issuers={issuers} selectedId={issuerId} />
            </>
          }
          icon={<ChartNoAxesCombinedIcon />}
          title={t("title")}
        />
      </div>
      <DashboardAttention attention={attention} />
      <DashboardKpiCards
        balance={metrics.balance}
        buckets={metrics.buckets}
        issuerId={issuerId}
        periodWindow={periodWindow}
      />
      <DashboardMonthlyChart
        data={metrics.monthly}
        subtitle={
          period.kind === "year"
            ? t("chart.subtitleYear", { year: String(period.year) })
            : t("chart.subtitleRolling")
        }
      />
      <DashboardRecentInvoices rows={metrics.recent} />
    </div>
  );
}
