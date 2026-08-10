import { pragueTodayIso } from "@/lib/invoice-status-sql";
import { getDefaultWorkspaceId } from "@/lib/workspace-id";
import { deriveStatus, type InvoiceStatus } from "@invoicey/invoice-core/status";
import { issuerBusinesses, invoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, desc, eq } from "drizzle-orm";

export type StatusBucket = {
	status: InvoiceStatus | "upcoming";
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
	status: InvoiceStatus;
};

function addDaysIso(iso: string, days: number): string {
	const d = new Date(`${iso}T12:00:00.000Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Aggregates workspace invoices for the dashboard (optional issuer filter).
 */
export async function loadDashboardMetrics(opts?: {
	issuerId?: string;
}): Promise<{
	buckets: StatusBucket[];
	monthly: MonthPoint[];
	recent: RecentInvoice[];
	issuerCount: number;
}> {
	const workspaceId = getDefaultWorkspaceId();
	const todayIso = pragueTodayIso();
	const upcomingEnd = addDaysIso(todayIso, 14);

	const base = [eq(invoices.workspaceId, workspaceId)];
	if (opts?.issuerId) {
		base.push(eq(invoices.issuerId, opts.issuerId));
	}

	const rows = await db
		.select()
		.from(invoices)
		.where(and(...base));

	const now = new Date();
	const tally: Record<InvoiceStatus, { count: number; total: number }> = {
		draft: { count: 0, total: 0 },
		issued: { count: 0, total: 0 },
		overdue: { count: 0, total: 0 },
		paid: { count: 0, total: 0 },
		cancelled: { count: 0, total: 0 },
	};
	let upcoming = { count: 0, total: 0 };

	for (const row of rows) {
		const status = deriveStatus(
			{
				issuedAt: row.issuedAt,
				dueDate: new Date(`${row.dueDate}T12:00:00.000Z`),
				paidAt: row.paidAt,
				cancelledAt: row.cancelledAt,
			},
			now,
		);
		const amount = Number(row.total) || 0;
		tally[status].count += 1;
		tally[status].total += amount;

		if (
			status === "issued" &&
			row.dueDate >= todayIso &&
			row.dueDate <= upcomingEnd
		) {
			upcoming.count += 1;
			upcoming.total += amount;
		}
	}

	const buckets: StatusBucket[] = (
		["draft", "issued", "paid", "overdue"] as const
	).map((status) => ({
		status,
		count: tally[status].count,
		total: tally[status].total,
	}));
	buckets.push({
		status: "upcoming",
		count: upcoming.count,
		total: upcoming.total,
	});

	const monthlyMap = new Map<string, MonthPoint>();
	const cursor = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
	);
	for (let i = 0; i < 12; i++) {
		const key = monthKey(cursor);
		monthlyMap.set(key, { month: key, issued: 0, paid: 0 });
		cursor.setUTCMonth(cursor.getUTCMonth() + 1);
	}

	for (const row of rows) {
		if (row.issuedAt) {
			const key = monthKey(new Date(row.issuedAt));
			const point = monthlyMap.get(key);
			if (point) {
				point.issued += Number(row.total) || 0;
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
		status: deriveStatus(
			{
				issuedAt: row.issuedAt,
				dueDate: new Date(`${row.dueDate}T12:00:00.000Z`),
				paidAt: row.paidAt,
				cancelledAt: row.cancelledAt,
			},
			now,
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
		issuerCount: issuerRows.length,
	};
}
