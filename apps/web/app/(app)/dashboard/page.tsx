import { DashboardIssuerFilter } from "@/components/dashboard/dashboard-issuer-filter";
import { DashboardMonthlyChart } from "@/components/dashboard/dashboard-monthly-chart";
import { DashboardRecentInvoices } from "@/components/dashboard/dashboard-recent-invoices";
import { DashboardStatusCards } from "@/components/dashboard/dashboard-status-cards";
import { Button } from "@/components/ui/button";
import { loadDashboardMetrics } from "@/lib/dashboard-metrics";
import { loadIssuerOptions } from "@/lib/load-parties";
import { ensureDefaultWorkspace } from "@/lib/workspace-id";
import Link from "next/link";

type Search = Promise<{ issuerId?: string }>;

export default async function DashboardPage({
	searchParams,
}: {
	searchParams: Search;
}) {
	await ensureDefaultWorkspace();
	const sp = await searchParams;
	const issuerId = sp.issuerId?.trim() || undefined;
	const [issuers, metrics] = await Promise.all([
		loadIssuerOptions(),
		loadDashboardMetrics({ issuerId }),
	]);

	if (metrics.issuerCount === 0) {
		return (
			<div className="flex flex-1 flex-col items-start gap-4 px-4 py-10 lg:px-6">
				<h1 className="text-2xl font-semibold tracking-tight">Welcome to Invoicey</h1>
				<p className="text-muted-foreground max-w-lg">
					Create your first issuer (your business) to start drafting invoices
					with ARES lookup, numbering, and PDF / ISDOC export.
				</p>
				<Button render={<Link href="/issuers/new" prefetch />} size="sm">
					Create your first issuer
				</Button>
			</div>
		);
	}

	return (
		<div className="@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
			<div className="flex flex-wrap items-end justify-between gap-3 px-4 lg:px-6">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
					<p className="text-muted-foreground text-sm">
						Invoicing pulse for the default workspace.
					</p>
				</div>
				<Button render={<Link href="/invoices/new" prefetch />} size="sm">
					New invoice
				</Button>
			</div>
			<DashboardIssuerFilter issuers={issuers} selectedId={issuerId} />
			<DashboardStatusCards buckets={metrics.buckets} />
			<div className="px-4 lg:px-6">
				<DashboardMonthlyChart data={metrics.monthly} />
			</div>
			<DashboardRecentInvoices rows={metrics.recent} />
		</div>
	);
}
