import { pragueTodayIso } from "@/lib/invoice-status-sql";
import {
	resolveDisplayStatus,
	type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";
import { issuerBusinesses, invoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, desc, eq } from "drizzle-orm";

export type StatusBucket = {
	status: InvoiceDisplayStatus;
	count: number;
	total: number;
};

export type MonthPoint = {
	month: string;
	issued: number;
	paid: number;
};

export type RecentInvoice = {
	id: string;
	number: string | null;
	clientName: string;
	total: string;
	currency: string;
	issueDate: string;
	dueDate: string;
	displayStatus: InvoiceDisplayStatus;
};

export type DashboardBalance = {
	issuedVolume12m: number;
	issuedCount12m: number;
	outstanding: number;
	outstandingCount: number;
};

function monthKey(d: Date): string {
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Aggregates workspace invoices for the dashboard (optional issuer filter).
 */
export async function loadDashboardMetrics(
	workspaceId: string,
	opts?: {
		issuerId?: string;
	},
): Promise<{
	buckets: StatusBucket[];
	monthly: MonthPoint[];
	recent: RecentInvoice[];
	balance: DashboardBalance;
	issuerCount: number;
}> {
	const todayIso = pragueTodayIso();

	const base = [eq(invoices.workspaceId, workspaceId)];
	if (opts?.issuerId) {
		base.push(eq(invoices.issuerId, opts.issuerId));
	}

	const rows = await db
		.select()
		.from(invoices)
		.where(and(...base));

	const now = new Date();
	const tally: Record<InvoiceDisplayStatus, { count: number; total: number }> =
		{
			draft: { count: 0, total: 0 },
			unpaid: { count: 0, total: 0 },
			overdue: { count: 0, total: 0 },
			paid: { count: 0, total: 0 },
			future: { count: 0, total: 0 },
			cancelled: { count: 0, total: 0 },
		};

	for (const row of rows) {
		const status = resolveDisplayStatus(
			{
				issuedAt: row.issuedAt,
				dueDate: row.dueDate,
				paidAt: row.paidAt,
				cancelledAt: row.cancelledAt,
				issueDate: row.issueDate,
			},
			todayIso,
		);
		const amount = Number(row.total) || 0;
		tally[status].count += 1;
		tally[status].total += amount;
	}

	const primary: InvoiceDisplayStatus[] = [
		"paid",
		"draft",
		"unpaid",
		"overdue",
		"future",
	];
	const buckets: StatusBucket[] = primary.map((status) => ({
		status,
		count: tally[status].count,
		total: tally[status].total,
	}));
	if (tally.cancelled.count > 0) {
		buckets.push({
			status: "cancelled",
			count: tally.cancelled.count,
			total: tally.cancelled.total,
		});
	}

	const monthlyMap = new Map<string, MonthPoint>();
	const cursor = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
	);
	const windowStart = new Date(cursor);
	for (let i = 0; i < 12; i++) {
		const key = monthKey(cursor);
		monthlyMap.set(key, { month: key, issued: 0, paid: 0 });
		cursor.setUTCMonth(cursor.getUTCMonth() + 1);
	}

	let issuedVolume12m = 0;
	let issuedCount12m = 0;
	for (const row of rows) {
		if (row.issuedAt) {
			const issuedAt = new Date(row.issuedAt);
			const key = monthKey(issuedAt);
			const point = monthlyMap.get(key);
			const amount = Number(row.total) || 0;
			if (point) {
				point.issued += amount;
			}
			if (issuedAt >= windowStart) {
				issuedVolume12m += amount;
				issuedCount12m += 1;
			}
		}
		if (row.paidAt) {
			const key = monthKey(new Date(row.paidAt));
			const point = monthlyMap.get(key);
			if (point) {
				point.paid += Number(row.total) || 0;
			}
		}
	}

	const outstanding =
		tally.unpaid.total + tally.overdue.total + tally.future.total;
	const outstandingCount =
		tally.unpaid.count + tally.overdue.count + tally.future.count;

	const recentRows = await db
		.select()
		.from(invoices)
		.where(and(...base))
		.orderBy(desc(invoices.updatedAt))
		.limit(10);

	const recent: RecentInvoice[] = recentRows.map((row) => ({
		id: row.id,
		number: row.number,
		clientName: row.clientName,
		total: row.total,
		currency: row.currency,
		issueDate: row.issueDate,
		dueDate: row.dueDate,
		displayStatus: resolveDisplayStatus(
			{
				issuedAt: row.issuedAt,
				dueDate: row.dueDate,
				paidAt: row.paidAt,
				cancelledAt: row.cancelledAt,
				issueDate: row.issueDate,
			},
			todayIso,
		),
	}));

	const issuerRows = await db
		.select({ id: issuerBusinesses.id })
		.from(issuerBusinesses)
		.where(eq(issuerBusinesses.workspaceId, workspaceId));

	return {
		buckets,
		monthly: [...monthlyMap.values()],
		recent,
		balance: {
			issuedVolume12m,
			issuedCount12m,
			outstanding,
			outstandingCount,
		},
		issuerCount: issuerRows.length,
	};
}
