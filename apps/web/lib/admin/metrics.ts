import "server-only";
import { displayStatusWhere, pragueTodayIso } from "@/lib/invoice-status-sql";
import { count, desc, eq, gte, sql } from "drizzle-orm";

import {
  aiTokenBalances,
  aiUsageEvents,
  bankConnections,
  emailMessages,
  invoices,
  issuerBusinesses,
  plans,
  user,
  workspaces,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  INVOICE_DISPLAY_STATUSES,
  resolveDisplayStatus,
  type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";

import {
  emptyMonthlySeries,
  utcDaysAgo,
  utcFirstOfMonthMonthsAgo,
  type PlatformMonthPoint,
} from "./constants";

export type { PlatformMonthPoint };

export type PlatformStatusBucket = {
  status: InvoiceDisplayStatus;
  count: number;
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

export type PlatformVolumeByCurrency = {
  currency: string;
  count: number;
  volume: number;
};

export type PlatformPlanMixRow = {
  planId: string;
  planName: string;
  workspaceCount: number;
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
  issuedVolumeByCurrency: PlatformVolumeByCurrency[];
  issuedCount12m: number;
  planMix: PlatformPlanMixRow[];
  aiRemaining: number;
  aiBurn30d: number;
  emailBounce7d: number;
  emailComplaint7d: number;
  bankErrorCount: number;
  bankConnectionCount: number;
};

async function countTable(
  table:
    | typeof user
    | typeof workspaces
    | typeof issuerBusinesses
    | typeof invoices,
): Promise<number> {
  const [row] = await db.select({ value: count() }).from(table);
  return Number(row?.value ?? 0);
}

async function loadStatusBuckets(
  todayIso: string,
): Promise<PlatformStatusBucket[]> {
  const counts = await Promise.all(
    INVOICE_DISPLAY_STATUSES.map(async (status) => {
      const [row] = await db
        .select({ value: count() })
        .from(invoices)
        .where(displayStatusWhere(status, todayIso));
      return { status, count: Number(row?.value ?? 0) };
    }),
  );
  return counts.filter(
    (bucket) => bucket.status !== "cancelled" || bucket.count > 0,
  );
}

async function loadMonthly(windowStart: Date): Promise<PlatformMonthPoint[]> {
  const series = emptyMonthlySeries();
  const byMonth = new Map(series.map((p) => [p.month, p]));

  const [issuedRows, paidRows] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${invoices.issuedAt}), 'YYYY-MM')`,
        value: count(),
      })
      .from(invoices)
      .where(gte(invoices.issuedAt, windowStart))
      .groupBy(
        sql`to_char(date_trunc('month', ${invoices.issuedAt}), 'YYYY-MM')`,
      ),
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${invoices.paidAt}), 'YYYY-MM')`,
        value: count(),
      })
      .from(invoices)
      .where(gte(invoices.paidAt, windowStart))
      .groupBy(
        sql`to_char(date_trunc('month', ${invoices.paidAt}), 'YYYY-MM')`,
      ),
  ]);

  for (const row of issuedRows) {
    const point = byMonth.get(row.month);
    if (point) point.issued = Number(row.value);
  }
  for (const row of paidRows) {
    const point = byMonth.get(row.month);
    if (point) point.paid = Number(row.value);
  }
  return series;
}

export async function loadPlatformDashboardMetrics(): Promise<PlatformDashboardMetrics> {
  const todayIso = pragueTodayIso();
  const window12m = utcFirstOfMonthMonthsAgo(11);
  const window7d = utcDaysAgo(7);
  const window30d = utcDaysAgo(30);

  const [
    userCount,
    workspaceCount,
    issuerCount,
    invoiceCount,
    [adminRow],
    buckets,
    monthly,
    recentJoined,
    volumeRows,
    planRows,
    [aiRemainRow],
    [aiBurnRow],
    emailHealth,
    [bankTotalRow],
    [bankErrorRow],
  ] = await Promise.all([
    countTable(user),
    countTable(workspaces),
    countTable(issuerBusinesses),
    countTable(invoices),
    db
      .select({ value: count() })
      .from(user)
      .where(eq(user.platformRole, "admin")),
    loadStatusBuckets(todayIso),
    loadMonthly(window12m),
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
    db
      .select({
        currency: invoices.currency,
        count: count(),
        volume: sql<string>`coalesce(sum(${invoices.total}), 0)::text`,
      })
      .from(invoices)
      .where(gte(invoices.issuedAt, window12m))
      .groupBy(invoices.currency),
    db
      .select({
        planId: plans.id,
        planName: plans.name,
        workspaceCount: sql<number>`count(${workspaces.id})::int`,
      })
      .from(plans)
      .leftJoin(workspaces, eq(workspaces.planId, plans.id))
      .groupBy(plans.id, plans.name)
      .orderBy(desc(sql`count(${workspaces.id})`)),
    db
      .select({
        value: sql<number>`coalesce(sum(${aiTokenBalances.giftedRemaining} + ${aiTokenBalances.monthlyRemaining} + ${aiTokenBalances.purchasedRemaining}), 0)`,
      })
      .from(aiTokenBalances),
    db
      .select({
        value: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)`,
      })
      .from(aiUsageEvents)
      .where(
        sql`${aiUsageEvents.kind} = 'llm' and ${aiUsageEvents.createdAt} >= ${window30d}`,
      ),
    db
      .select({
        status: emailMessages.status,
        value: count(),
      })
      .from(emailMessages)
      .where(gte(emailMessages.createdAt, window7d))
      .groupBy(emailMessages.status),
    db.select({ value: count() }).from(bankConnections),
    db
      .select({ value: count() })
      .from(bankConnections)
      .where(
        sql`${bankConnections.consecutiveFailureCount} > 0 or ${bankConnections.lastSyncErrorCode} is not null`,
      ),
  ]);

  const issuedVolumeByCurrency: PlatformVolumeByCurrency[] = volumeRows.map(
    (row) => ({
      currency: row.currency,
      count: Number(row.count),
      volume: Number(row.volume) || 0,
    }),
  );

  let emailBounce7d = 0;
  let emailComplaint7d = 0;
  for (const row of emailHealth) {
    const n = Number(row.value);
    if (row.status === "bounced") emailBounce7d = n;
    if (row.status === "complained") emailComplaint7d = n;
  }

  return {
    userCount,
    workspaceCount,
    issuerCount,
    invoiceCount,
    platformAdminCount: Number(adminRow?.value ?? 0),
    buckets,
    monthly,
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
    issuedVolumeByCurrency,
    issuedCount12m: issuedVolumeByCurrency.reduce(
      (sum, row) => sum + row.count,
      0,
    ),
    planMix: planRows.map((row) => ({
      planId: row.planId,
      planName: row.planName,
      workspaceCount: Number(row.workspaceCount ?? 0),
    })),
    aiRemaining: Number(aiRemainRow?.value ?? 0),
    aiBurn30d: Number(aiBurnRow?.value ?? 0),
    emailBounce7d,
    emailComplaint7d,
    bankErrorCount: Number(bankErrorRow?.value ?? 0),
    bankConnectionCount: Number(bankTotalRow?.value ?? 0),
  };
}
