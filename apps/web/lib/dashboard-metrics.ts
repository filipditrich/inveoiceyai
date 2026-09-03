import { pragueTodayIso } from "@/lib/invoice-status-sql";
import {
  loadInvoiceStatusTallies,
  type StatusBucket,
} from "@/lib/invoices/status-summary";
import { and, desc, eq, gte, isNull, isNotNull, sql } from "drizzle-orm";

import {
  invoicePaymentAllocations,
  issuerBusinesses,
  invoices,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  resolveDisplayStatus,
  type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";

export type { StatusBucket };

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

export type CurrencyBalance = {
  currency: string;
  issuedVolume12m: number;
  outstanding: number;
};

export type DashboardBalance = {
  byCurrency: CurrencyBalance[];
  issuedCount12m: number;
  outstandingCount: number;
};

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addAmount(
  map: Record<string, number>,
  currency: string,
  amount: number,
) {
  const code = currency || "CZK";
  map[code] = (map[code] ?? 0) + amount;
}

/** The 12 month keys the chart shows, oldest first, plus the window start. */
type ChartWindow = { keys: string[]; start: Date };

function chartWindow(now: Date): ChartWindow {
  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
  );
  const start = new Date(cursor);
  const keys: string[] = [];
  for (let i = 0; i < 12; i++) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return { keys, start };
}

/**
 * Aggregates workspace invoices for the dashboard (optional issuer filter).
 *
 * Everything here is a bounded query: grouped tallies, a 12-row month series,
 * a 12-month volume roll-up, and the 10 most recent invoices. The dashboard
 * must not get slower as a workspace accumulates invoices, so nothing reads
 * the full invoice table — those rows carry three JSONB columns each.
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
  const now = new Date();
  const { keys: monthKeys, start: windowStart } = chartWindow(now);
  const windowStartIso = windowStart.toISOString();

  const base = [eq(invoices.workspaceId, workspaceId)];
  if (opts?.issuerId) {
    base.push(eq(invoices.issuerId, opts.issuerId));
  }

  const issuedMonth = sql<string>`to_char(${invoices.issuedAt} at time zone 'UTC', 'YYYY-MM')`;
  const invoiceCurrency = sql<string>`coalesce(nullif(${invoices.currency}, ''), 'CZK')`;

  const [
    tallies,
    issuedMonthly,
    issuedVolume,
    paidMonthly,
    recentRows,
    issuerCountRow,
  ] = await Promise.all([
    loadInvoiceStatusTallies(base, todayIso),
    // CZK-only issued series for the chart (no FX mix).
    db
      .select({
        month: issuedMonth,
        amount: sql<string>`sum(${invoices.total})::text`,
      })
      .from(invoices)
      .where(
        and(
          ...base,
          isNotNull(invoices.issuedAt),
          eq(invoices.currency, "CZK"),
          gte(invoices.issuedAt, sql`${windowStartIso}::timestamptz`),
        ),
      )
      .groupBy(issuedMonth),
    // 12-month issued volume, all currencies, for the balance row.
    db
      .select({
        currency: invoiceCurrency,
        amount: sql<string>`sum(${invoices.total})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(
        and(
          ...base,
          isNotNull(invoices.issuedAt),
          gte(invoices.issuedAt, sql`${windowStartIso}::timestamptz`),
        ),
      )
      .groupBy(invoiceCurrency),
    db
      .select({
        month: sql<string>`substring(${invoicePaymentAllocations.effectiveDate} from 1 for 7)`,
        amount: sql<string>`sum(${invoicePaymentAllocations.amount})::text`,
      })
      .from(invoicePaymentAllocations)
      .innerJoin(invoices, eq(invoices.id, invoicePaymentAllocations.invoiceId))
      .where(
        and(
          eq(invoicePaymentAllocations.workspaceId, workspaceId),
          isNull(invoicePaymentAllocations.reversedAt),
          eq(invoicePaymentAllocations.currency, "CZK"),
          ...(opts?.issuerId ? [eq(invoices.issuerId, opts.issuerId)] : []),
        ),
      )
      .groupBy(
        sql`substring(${invoicePaymentAllocations.effectiveDate} from 1 for 7)`,
      ),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        clientName: invoices.clientName,
        total: invoices.total,
        currency: invoices.currency,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        issuedAt: invoices.issuedAt,
        paidAt: invoices.paidAt,
        cancelledAt: invoices.cancelledAt,
      })
      .from(invoices)
      .where(and(...base))
      .orderBy(desc(invoices.updatedAt))
      .limit(10),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(issuerBusinesses)
      .where(eq(issuerBusinesses.workspaceId, workspaceId)),
  ]);

  const primary: InvoiceDisplayStatus[] = [
    "paid",
    "draft",
    "unpaid",
    "overdue",
    "future",
  ];
  const buckets: StatusBucket[] = primary.map((status) => ({
    status,
    count: tallies[status].count,
    totalsByCurrency: tallies[status].totalsByCurrency,
  }));
  if (tallies.cancelled.count > 0) {
    buckets.push({
      status: "cancelled",
      count: tallies.cancelled.count,
      totalsByCurrency: tallies.cancelled.totalsByCurrency,
    });
  }

  const issuedByMonth = new Map(
    issuedMonthly.map((r) => [r.month, Number(r.amount) || 0]),
  );
  const paidByMonth = new Map(
    paidMonthly.map((r) => [r.month, Number(r.amount) || 0]),
  );
  const monthly: MonthPoint[] = monthKeys.map((month) => ({
    month,
    issued: issuedByMonth.get(month) ?? 0,
    paid: paidByMonth.get(month) ?? 0,
  }));

  const issuedByCurrency: Record<string, number> = {};
  let issuedCount12m = 0;
  for (const row of issuedVolume) {
    addAmount(issuedByCurrency, row.currency, Number(row.amount) || 0);
    issuedCount12m += row.count;
  }

  const outstandingByCurrency: Record<string, number> = {};
  for (const status of ["unpaid", "overdue", "future"] as const) {
    for (const [currency, amount] of Object.entries(
      tallies[status].totalsByCurrency,
    )) {
      addAmount(outstandingByCurrency, currency, amount);
    }
  }

  const outstandingCount =
    tallies.unpaid.count + tallies.overdue.count + tallies.future.count;

  const currencyCodes = new Set([
    ...Object.keys(issuedByCurrency),
    ...Object.keys(outstandingByCurrency),
  ]);
  if (currencyCodes.size === 0) {
    currencyCodes.add("CZK");
  }
  const byCurrency: CurrencyBalance[] = [...currencyCodes]
    .sort()
    .map((currency) => ({
      currency,
      issuedVolume12m: issuedByCurrency[currency] ?? 0,
      outstanding: outstandingByCurrency[currency] ?? 0,
    }));

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

  return {
    buckets,
    monthly,
    recent,
    balance: {
      byCurrency,
      issuedCount12m,
      outstandingCount,
    },
    issuerCount: issuerCountRow[0]?.count ?? 0,
  };
}
