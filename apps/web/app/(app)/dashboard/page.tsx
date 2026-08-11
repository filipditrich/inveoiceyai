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

type Search = Promise<{ issuerId?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Search;
}) {
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
          Vítejte v Invoicey
        </h1>
        <p className="text-muted-foreground max-w-lg">
          Vytvořte prvního vystavovatele (vaši firmu), abyste mohli vystavovat
          faktury s ARES, číslováním a PDF / ISDOC exportem.
        </p>
        <Button render={<Link href="/welcome" prefetch />} size="sm">
          Vytvořit prvního vystavovatele
        </Button>
      </div>
    );
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Přehled</h1>
          <p className="text-muted-foreground text-sm">
            Stavy faktur a obrat za posledních 12 měsíců.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            render={<Link href="/invoices" prefetch />}
            size="sm"
            variant="outline"
          >
            Přejít na faktury
          </Button>
          <Button render={<Link href="/invoices/new" prefetch />} size="sm">
            New invoice
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
