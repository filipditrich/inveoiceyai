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
  /** totals by currency */
  totalsByCurrency: Record<string, number>;
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
  const tally: Record<
    InvoiceDisplayStatus,
    { count: number; totalsByCurrency: Record<string, number> }
  > = {
    draft: { count: 0, totalsByCurrency: {} },
    unpaid: { count: 0, totalsByCurrency: {} },
    overdue: { count: 0, totalsByCurrency: {} },
    paid: { count: 0, totalsByCurrency: {} },
    future: { count: 0, totalsByCurrency: {} },
    cancelled: { count: 0, totalsByCurrency: {} },
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
    addAmount(tally[status].totalsByCurrency, row.currency, amount);
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
    totalsByCurrency: tally[status].totalsByCurrency,
  }));
  if (tally.cancelled.count > 0) {
    buckets.push({
      status: "cancelled",
      count: tally.cancelled.count,
      totalsByCurrency: tally.cancelled.totalsByCurrency,
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

  const issuedByCurrency: Record<string, number> = {};
  const outstandingByCurrency: Record<string, number> = {};
  let issuedCount12m = 0;

  for (const row of rows) {
    const currency = row.currency || "CZK";
    const amount = Number(row.total) || 0;
    /** monthly chart is CZK-only (no FX mix) */
    const isCzk = currency === "CZK";
    if (row.issuedAt) {
      const issuedAt = new Date(row.issuedAt);
      const key = monthKey(issuedAt);
      const point = monthlyMap.get(key);
      if (point && isCzk) {
        point.issued += amount;
      }
      if (issuedAt >= windowStart) {
        addAmount(issuedByCurrency, currency, amount);
        issuedCount12m += 1;
      }
    }
    if (row.paidAt && isCzk) {
      const key = monthKey(new Date(row.paidAt));
      const point = monthlyMap.get(key);
      if (point) {
        point.paid += amount;
      }
    }
  }

  for (const status of ["unpaid", "overdue", "future"] as const) {
    for (const [currency, amount] of Object.entries(
      tally[status].totalsByCurrency,
    )) {
      addAmount(outstandingByCurrency, currency, amount);
    }
  }

  const outstandingCount =
    tally.unpaid.count + tally.overdue.count + tally.future.count;

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
      byCurrency,
      issuedCount12m,
      outstandingCount,
    },
    issuerCount: issuerRows.length,
  };
}
