import type { DashboardBalance } from "@/lib/dashboard-metrics";

function formatCzk(amount: number): string {
	return new Intl.NumberFormat("cs-CZ", {
		style: "currency",
		currency: "CZK",
		maximumFractionDigits: 0,
	}).format(amount);
}

export function DashboardBalanceRow({ balance }: { balance: DashboardBalance }) {
	return (
		<div className="grid gap-4 px-4 sm:grid-cols-2 lg:px-6">
			<div className="rounded-md border px-4 py-3">
				<div className="text-muted-foreground text-sm">
					Vystavené faktury (12 měsíců)
				</div>
				<div className="mt-1 text-2xl font-semibold tabular-nums">
					{formatCzk(balance.issuedVolume12m)}
				</div>
				<div className="text-muted-foreground text-xs tabular-nums">
					{balance.issuedCount12m} faktur
				</div>
			</div>
			<div className="rounded-md border px-4 py-3">
				<div className="text-muted-foreground text-sm">
					Neuhrazeno (včetně po splatnosti a budoucích)
				</div>
				<div className="mt-1 text-2xl font-semibold tabular-nums text-orange-700 dark:text-orange-400">
					{formatCzk(balance.outstanding)}
				</div>
				<div className="text-muted-foreground text-xs tabular-nums">
					{balance.outstandingCount} faktur
				</div>
			</div>
		</div>
	);
}
