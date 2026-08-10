import type { StatusBucket } from "@/lib/dashboard-metrics";
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const LABELS: Record<StatusBucket["status"], { title: string; hint: string }> =
	{
		draft: { title: "Drafts", hint: "Not yet issued" },
		issued: { title: "Issued (open)", hint: "Unpaid, not overdue" },
		paid: { title: "Paid", hint: "Collected" },
		overdue: { title: "Overdue", hint: "Past due date" },
		upcoming: { title: "Due ≤ 14 days", hint: "Open invoices coming due" },
		cancelled: { title: "Cancelled", hint: "Voided" },
	};

function formatCzk(amount: number): string {
	return new Intl.NumberFormat("cs-CZ", {
		style: "currency",
		currency: "CZK",
		maximumFractionDigits: 0,
	}).format(amount);
}

export function DashboardStatusCards({ buckets }: { buckets: StatusBucket[] }) {
	return (
		<div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-5">
			{buckets.map((b) => {
				const meta = LABELS[b.status];
				return (
					<Card className="@container/card" key={b.status}>
						<CardHeader>
							<CardDescription>{meta.title}</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								{b.count}
							</CardTitle>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1 text-sm">
							<div className="font-medium tabular-nums">
								{formatCzk(b.total)}
							</div>
							<div className="text-muted-foreground">{meta.hint}</div>
						</CardFooter>
					</Card>
				);
			})}
		</div>
	);
}
