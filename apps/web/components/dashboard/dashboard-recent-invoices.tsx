import type { RecentInvoice } from "@/lib/dashboard-metrics";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import Link from "next/link";

export function DashboardRecentInvoices({ rows }: { rows: RecentInvoice[] }) {
	if (rows.length === 0) {
		return (
			<p className="text-muted-foreground px-4 text-sm lg:px-6">
				No invoices yet.{" "}
				<Link
					className="text-primary underline-offset-4 hover:underline"
					href="/invoices/new"
				>
					Create your first invoice
				</Link>
				.
			</p>
		);
	}

	return (
		<div className="px-4 lg:px-6">
			<div className="mb-3 flex items-center justify-between">
				<h2 className="text-lg font-medium">Recent invoices</h2>
				<Link
					className="text-muted-foreground text-sm underline-offset-4 hover:underline"
					href="/invoices"
				>
					View all
				</Link>
			</div>
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Number</TableHead>
							<TableHead>Client</TableHead>
							<TableHead>Issued</TableHead>
							<TableHead>Due</TableHead>
							<TableHead>Total</TableHead>
							<TableHead>Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.id}>
								<TableCell className="font-medium tabular-nums">
									<Link
										className="underline-offset-4 hover:underline"
										href={`/invoices/${row.id}`}
									>
										{row.number ?? "DRAFT"}
									</Link>
								</TableCell>
								<TableCell>{row.clientName}</TableCell>
								<TableCell>{row.issueDate}</TableCell>
								<TableCell>{row.dueDate}</TableCell>
								<TableCell className="tabular-nums">
									{Number(row.total).toFixed(2)} {row.currency}
								</TableCell>
								<TableCell>
									<span className="bg-muted rounded px-2 py-0.5 text-xs capitalize">
										{row.status}
									</span>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
