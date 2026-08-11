import type { StatusBucket } from "@/lib/dashboard-metrics";
import { DISPLAY_STATUS_CARD_ACCENT } from "@/lib/invoice-status-ui";
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { DISPLAY_STATUS_LABELS } from "@invoicey/invoice-core/status-display";
import { cn } from "@/lib/utils";
import Link from "next/link";

function formatCzk(amount: number): string {
	return new Intl.NumberFormat("cs-CZ", {
		style: "currency",
		currency: "CZK",
		maximumFractionDigits: 0,
	}).format(amount);
}

function hrefFor(status: StatusBucket["status"], issuerId?: string): string {
	const params = new URLSearchParams({ status });
	if (issuerId) {
		params.set("issuerId", issuerId);
	}
	return `/invoices?${params.toString()}`;
}

export function DashboardStatusCards({
	buckets,
	issuerId,
}: {
	buckets: StatusBucket[];
	issuerId?: string;
}) {
	return (
		<div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-5">
			{buckets.map((b) => (
				<Link
					className="block transition-opacity hover:opacity-90"
					href={hrefFor(b.status, issuerId)}
					key={b.status}
				>
					<Card className="@container/card h-full">
						<CardHeader>
							<CardDescription
								className={cn(DISPLAY_STATUS_CARD_ACCENT[b.status])}
							>
								{DISPLAY_STATUS_LABELS[b.status]}
							</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								{formatCzk(b.total)}
							</CardTitle>
						</CardHeader>
						<CardFooter className="text-muted-foreground text-sm tabular-nums">
							{b.count}{" "}
							{b.count === 1 ? "faktura" : b.count < 5 ? "faktury" : "faktur"}
						</CardFooter>
					</Card>
				</Link>
			))}
		</div>
	);
}
