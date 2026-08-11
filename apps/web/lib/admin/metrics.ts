import "server-only";

import { pragueTodayIso } from "@/lib/invoice-status-sql";
import {
  resolveDisplayStatus,
  type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";
import { issuerBusinesses, invoices, user, workspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { count, desc, eq } from "drizzle-orm";

export type PlatformStatusBucket = {
  status: InvoiceDisplayStatus;
  count: number;
  total: number;
};

export type PlatformMonthPoint = {
  month: string;
  issued: number;
  paid: number;
};

export type PlatformRecentInvoice = {
  id: string;
  number: string | null;
  clientName: string;
  workspaceId: string;
  workspaceName: string;
  total: string;
  currency: string;
  issueDate: string;
  displayStatus: InvoiceDisplayStatus;
};

export type PlatformDashboardMetrics = {
  userCount: number;
  workspaceCount: number;
  issuerCount: number;
  invoiceCount: number;
  platformAdminCount: number;
  buckets: PlatformStatusBucket[];
  monthly: PlatformMonthPoint[];
  recent: PlatformRecentInvoice[];
  issuedVolume12m: number;
  issuedCount12m: number;
  outstanding: number;
  outstandingCount: number;
};

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function loadPlatformDashboardMetrics(): Promise<PlatformDashboardMetrics> {
  const todayIso = pragueTodayIso();

  const [
    [userRow],
    [workspaceRow],
    [issuerRow],
    [invoiceCountRow],
    [adminRow],
    invoiceRows,
    recentJoined,
  ] = await Promise.all([
    db.select({ value: count() }).from(user),
    db.select({ value: count() }).from(workspaces),
    db.select({ value: count() }).from(issuerBusinesses),
    db.select({ value: count() }).from(invoices),
    db
      .select({ value: count() })
      .from(user)
      .where(eq(user.platformRole, "admin")),
    db.select().from(invoices),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        clientName: invoices.clientName,
        workspaceId: invoices.workspaceId,
        workspaceName: workspaces.name,
        total: invoices.total,
        currency: invoices.currency,
        issueDate: invoices.issueDate,
        issuedAt: invoices.issuedAt,
        dueDate: invoices.dueDate,
        paidAt: invoices.paidAt,
        cancelledAt: invoices.cancelledAt,
      })
      .from(invoices)
      .innerJoin(workspaces, eq(invoices.workspaceId, workspaces.id))
      .orderBy(desc(invoices.updatedAt))
      .limit(10),
  ]);

  const tally: Record<InvoiceDisplayStatus, { count: number; total: number }> =
    {
      draft: { count: 0, total: 0 },
      unpaid: { count: 0, total: 0 },
      overdue: { count: 0, total: 0 },
      paid: { count: 0, total: 0 },
      future: { count: 0, total: 0 },
      cancelled: { count: 0, total: 0 },
    };

  const now = new Date();
  const monthlyMap = new Map<string, PlatformMonthPoint>();
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

  for (const row of invoiceRows) {
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

    if (row.issuedAt) {
      const issuedAt = new Date(row.issuedAt);
      const key = monthKey(issuedAt);
      const point = monthlyMap.get(key);
      if (point) point.issued += amount;
      if (issuedAt >= windowStart) {
        issuedVolume12m += amount;
        issuedCount12m += 1;
      }
    }
    if (row.paidAt) {
      const key = monthKey(new Date(row.paidAt));
      const point = monthlyMap.get(key);
      if (point) point.paid += Number(row.total) || 0;
    }
  }

  const primary: InvoiceDisplayStatus[] = [
    "paid",
    "draft",
    "unpaid",
    "overdue",
    "future",
  ];
  const buckets: PlatformStatusBucket[] = primary.map((status) => ({
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

  return {
    userCount: Number(userRow?.value ?? 0),
    workspaceCount: Number(workspaceRow?.value ?? 0),
    issuerCount: Number(issuerRow?.value ?? 0),
    invoiceCount: Number(invoiceCountRow?.value ?? 0),
    platformAdminCount: Number(adminRow?.value ?? 0),
    buckets,
    monthly: [...monthlyMap.values()],
    recent: recentJoined.map((row) => ({
      id: row.id,
      number: row.number,
      clientName: row.clientName,
      workspaceId: row.workspaceId,
      workspaceName: row.workspaceName,
      total: row.total,
      currency: row.currency,
      issueDate: row.issueDate,
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
    })),
    issuedVolume12m,
    issuedCount12m,
    outstanding: tally.unpaid.total + tally.overdue.total + tally.future.total,
    outstandingCount:
      tally.unpaid.count + tally.overdue.count + tally.future.count,
  };
}
