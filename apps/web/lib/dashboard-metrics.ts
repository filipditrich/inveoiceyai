import {
  dashboardAttentionActions,
  type DashboardAttentionAction,
} from "@/lib/dashboard-attention";
import {
  dashboardPeriodWindow,
  type DashboardPeriod,
  type DashboardPeriodWindow,
} from "@/lib/dashboard-period";
import { displayStatusWhere, pragueTodayIso } from "@/lib/invoice-status-sql";
import {
  loadInvoiceStatusTallies,
  type StatusBucket,
} from "@/lib/invoices/status-summary";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNull,
  isNotNull,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  invoicePaymentAllocations,
  invoices,
  issuerBusinesses,
  paymentMatchProposals,
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
  issuedVolume: number;
  outstanding: number;
};

export type DashboardBalance = {
  byCurrency: CurrencyBalance[];
  issuedCount: number;
  outstandingCount: number;
};

export type AttentionInvoice = {
  id: string;
  number: string | null;
  clientName: string;
  total: string;
  currency: string;
  dueDate: string;
};

export type DashboardAttention = {
  actions: DashboardAttentionAction[];
  overduePreview: AttentionInvoice[];
  hasAnyInvoices: boolean;
};

const PRIMARY_STATUSES: InvoiceDisplayStatus[] = [
  "paid",
  "draft",
  "unpaid",
  "overdue",
  "future",
];

function addAmount(
  map: Record<string, number>,
  currency: string,
  amount: number,
) {
  const code = currency || "CZK";
  map[code] = (map[code] ?? 0) + amount;
}

function workspaceInvoiceConditions(
  workspaceId: string,
  issuerId?: string,
): SQL[] {
  const conditions: SQL[] = [eq(invoices.workspaceId, workspaceId)];
  if (issuerId) conditions.push(eq(invoices.issuerId, issuerId));
  return conditions;
}

function issueDateWindowConditions(window: DashboardPeriodWindow): SQL[] {
  const conditions: SQL[] = [];
  if (window.from) conditions.push(gte(invoices.issueDate, window.from));
  if (window.to) conditions.push(lte(invoices.issueDate, window.to));
  return conditions;
}

function bucketsFromTallies(
  tallies: Awaited<ReturnType<typeof loadInvoiceStatusTallies>>,
): StatusBucket[] {
  const buckets: StatusBucket[] = PRIMARY_STATUSES.map((status) => ({
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
  return buckets;
}

function tallyHasInvoices(
  tallies: Awaited<ReturnType<typeof loadInvoiceStatusTallies>>,
): boolean {
  return (
    tallies.paid.count +
      tallies.draft.count +
      tallies.unpaid.count +
      tallies.overdue.count +
      tallies.future.count +
      tallies.cancelled.count >
    0
  );
}

/**
 * Aggregates workspace invoices for the dashboard (optional issuer + period).
 *
 * Everything here is a bounded query: grouped tallies, a month series for the
 * selected window, a volume roll-up, and the 10 most recent invoices. The
 * dashboard must not get slower as a workspace accumulates invoices, so nothing
 * reads the full invoice table — those rows carry three JSONB columns each.
 */
export async function loadDashboardMetrics(
  workspaceId: string,
  opts: {
    issuerId?: string;
    period: DashboardPeriod;
  },
): Promise<{
  buckets: StatusBucket[];
  monthly: MonthPoint[];
  recent: RecentInvoice[];
  balance: DashboardBalance;
  issuerCount: number;
}> {
  const todayIso = pragueTodayIso();
  const periodWindow = dashboardPeriodWindow(opts.period, todayIso);
  const base = workspaceInvoiceConditions(workspaceId, opts.issuerId);
  const inPeriod = [...base, ...issueDateWindowConditions(periodWindow)];
  const lastChartMonth = periodWindow.chartKeys.at(-1) ?? todayIso.slice(0, 7);
  const chartFrom = `${periodWindow.chartKeys[0]}-01`;
  const chartTo = `${lastChartMonth}-31`;

  const issuedMonth = sql<string>`substring(${invoices.issueDate} from 1 for 7)`;
  const invoiceCurrency = sql<string>`coalesce(nullif(${invoices.currency}, ''), 'CZK')`;
  const paidMonth = sql<string>`substring(${invoicePaymentAllocations.effectiveDate} from 1 for 7)`;

  const [
    tallies,
    issuedMonthly,
    issuedVolume,
    paidMonthly,
    recentRows,
    issuerCountRow,
  ] = await Promise.all([
    loadInvoiceStatusTallies(inPeriod, todayIso),
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
          gte(invoices.issueDate, chartFrom),
          lte(invoices.issueDate, chartTo),
        ),
      )
      .groupBy(issuedMonth),
    db
      .select({
        currency: invoiceCurrency,
        amount: sql<string>`sum(${invoices.total})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(and(...inPeriod, isNotNull(invoices.issuedAt)))
      .groupBy(invoiceCurrency),
    db
      .select({
        month: paidMonth,
        amount: sql<string>`sum(${invoicePaymentAllocations.amount})::text`,
      })
      .from(invoicePaymentAllocations)
      .innerJoin(invoices, eq(invoices.id, invoicePaymentAllocations.invoiceId))
      .where(
        and(
          eq(invoicePaymentAllocations.workspaceId, workspaceId),
          isNull(invoicePaymentAllocations.reversedAt),
          eq(invoicePaymentAllocations.currency, "CZK"),
          gte(invoicePaymentAllocations.effectiveDate, chartFrom),
          lte(invoicePaymentAllocations.effectiveDate, chartTo),
          ...(opts.issuerId ? [eq(invoices.issuerId, opts.issuerId)] : []),
        ),
      )
      .groupBy(paidMonth),
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

  const issuedByMonth = new Map(
    issuedMonthly.map((r) => [r.month, Number(r.amount) || 0]),
  );
  const paidByMonth = new Map(
    paidMonthly.map((r) => [r.month, Number(r.amount) || 0]),
  );
  const monthly: MonthPoint[] = periodWindow.chartKeys.map((month) => ({
    month,
    issued: issuedByMonth.get(month) ?? 0,
    paid: paidByMonth.get(month) ?? 0,
  }));

  const issuedByCurrency: Record<string, number> = {};
  let issuedCount = 0;
  for (const row of issuedVolume) {
    addAmount(issuedByCurrency, row.currency, Number(row.amount) || 0);
    issuedCount += row.count;
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
      issuedVolume: issuedByCurrency[currency] ?? 0,
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
    buckets: bucketsFromTallies(tallies),
    monthly,
    recent,
    balance: {
      byCurrency,
      issuedCount,
      outstandingCount,
    },
    issuerCount: issuerCountRow[0]?.count ?? 0,
  };
}

/** Open work right now — not scoped to the selected dashboard period. */
export async function loadDashboardAttention(
  workspaceId: string,
  opts?: { issuerId?: string },
): Promise<DashboardAttention> {
  const todayIso = pragueTodayIso();
  const base = workspaceInvoiceConditions(workspaceId, opts?.issuerId);
  const overdueWhere = displayStatusWhere("overdue", todayIso);

  const [tallies, matchCountRow, overdueRows] = await Promise.all([
    loadInvoiceStatusTallies(base, todayIso),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentMatchProposals)
      .innerJoin(invoices, eq(invoices.id, paymentMatchProposals.invoiceId))
      .where(
        and(
          eq(paymentMatchProposals.workspaceId, workspaceId),
          eq(paymentMatchProposals.status, "pending"),
          ...(opts?.issuerId ? [eq(invoices.issuerId, opts.issuerId)] : []),
        ),
      ),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        clientName: invoices.clientName,
        total: invoices.total,
        currency: invoices.currency,
        dueDate: invoices.dueDate,
      })
      .from(invoices)
      .where(and(...base, overdueWhere))
      .orderBy(asc(invoices.dueDate))
      .limit(3),
  ]);

  return {
    actions: dashboardAttentionActions({
      overdueCount: tallies.overdue.count,
      overdueTotals: tallies.overdue.totalsByCurrency,
      unpaidCount: tallies.unpaid.count,
      unpaidTotals: tallies.unpaid.totalsByCurrency,
      draftCount: tallies.draft.count,
      pendingMatchCount: matchCountRow[0]?.count ?? 0,
      issuerId: opts?.issuerId,
    }),
    overduePreview: overdueRows.map((row) => ({
      id: row.id,
      number: row.number,
      clientName: row.clientName,
      total: row.total,
      currency: row.currency,
      dueDate: row.dueDate,
    })),
    hasAnyInvoices: tallyHasInvoices(tallies),
  };
}
