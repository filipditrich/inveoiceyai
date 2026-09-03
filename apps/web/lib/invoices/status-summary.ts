import "server-only";
import { and, sql, type SQL } from "drizzle-orm";

import { invoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  INVOICE_DISPLAY_STATUSES,
  type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";

export type StatusTally = {
  count: number;
  /** totals by currency code */
  totalsByCurrency: Record<string, number>;
};

/** One tally per display bucket — spelled out rather than a `Record`, so the
 * set of buckets is part of the type and a new status is a compile error. */
export type StatusTallies = {
  draft: StatusTally;
  unpaid: StatusTally;
  overdue: StatusTally;
  paid: StatusTally;
  future: StatusTally;
  cancelled: StatusTally;
};

export type StatusBucket = {
  status: InvoiceDisplayStatus;
  count: number;
  totalsByCurrency: Record<string, number>;
};

export function emptyStatusTallies(): StatusTallies {
  return {
    draft: { count: 0, totalsByCurrency: {} },
    unpaid: { count: 0, totalsByCurrency: {} },
    overdue: { count: 0, totalsByCurrency: {} },
    paid: { count: 0, totalsByCurrency: {} },
    future: { count: 0, totalsByCurrency: {} },
    cancelled: { count: 0, totalsByCurrency: {} },
  };
}

/**
 * `resolveDisplayStatus` expressed in SQL, same priority order:
 * cancelled → draft → paid → future → overdue → unpaid.
 *
 * Kept next to the tally so the two can only drift together. The status filter
 * predicates in `invoice-status-sql.ts` encode the same rules per bucket.
 */
function displayStatusExpr(todayIso: string): SQL<string> {
  return sql<string>`case
    when ${invoices.cancelledAt} is not null then 'cancelled'
    when ${invoices.issuedAt} is null then 'draft'
    when ${invoices.paidAt} is not null then 'paid'
    when ${invoices.issueDate} > ${todayIso} then 'future'
    when ${invoices.dueDate} < ${todayIso} then 'overdue'
    else 'unpaid'
  end`;
}

/**
 * Per-status counts and per-currency amounts for the workspace, as one grouped
 * query.
 *
 * The naive version of this reads every matching invoice row — including the
 * three JSONB columns each one carries — and tallies in JS, so a workspace with
 * a few thousand invoices moves megabytes per page view. Postgres does the
 * whole thing in a single scan.
 *
 * Open buckets (`unpaid`, `overdue`, `future`) sum the outstanding remainder;
 * closed ones sum the document total. That mirrors what the cards display.
 */
export async function loadInvoiceStatusTallies(
  conditions: SQL[],
  todayIso: string,
): Promise<StatusTallies> {
  const status = displayStatusExpr(todayIso);
  const currency = sql<string>`coalesce(nullif(${invoices.currency}, ''), 'CZK')`;
  const total = sql`abs(coalesce(${invoices.total}, 0))`;

  /**
   * The open buckets — `unpaid`, `overdue`, `future` — are exactly "not
   * cancelled, issued, not paid", so this tests the columns directly instead of
   * nesting `status` inside the aggregate. Postgres rejects that nesting:
   * an expression inside `sum()` is not matched against the GROUP BY key.
   */
  const amount = sql`case
    when ${invoices.cancelledAt} is null
     and ${invoices.issuedAt} is not null
     and ${invoices.paidAt} is null
      then greatest(${total} - coalesce(${invoices.paidAmount}, 0), 0)
    else ${total}
  end`;

  const rows = await db
    .select({
      status: status,
      currency: currency,
      count: sql<number>`count(*)::int`,
      amount: sql<string>`sum(${amount})::text`,
    })
    .from(invoices)
    .where(and(...conditions))
    /**
     * Group by output position, not by repeating the expressions. Drizzle
     * renders each `sql` fragment with fresh bind parameters per use, so a
     * repeated `${todayIso}` produces `$1` in the select list and `$4` in the
     * GROUP BY — Postgres then treats them as different expressions and
     * rejects the query. Positions must stay in sync with the select keys
     * above: 1 = status, 2 = currency.
     */
    .groupBy(sql`1`, sql`2`);

  const tallies = emptyStatusTallies();
  for (const row of rows) {
    // The CASE above can only produce the six display statuses, but a row is
    // still skipped rather than trusted if Postgres ever returns anything else.
    // SAFETY: `row.status` is only used as a lookup key; a miss falls through.
    const bucket = tallies[row.status as InvoiceDisplayStatus];
    if (!bucket) {
      continue;
    }
    bucket.count += row.count;
    bucket.totalsByCurrency[row.currency] =
      (bucket.totalsByCurrency[row.currency] ?? 0) + Number(row.amount ?? 0);
  }
  return tallies;
}

/** Tallies as the ordered bucket list the summary cards render. */
export function toStatusBuckets(
  tallies: StatusTallies,
  order: readonly InvoiceDisplayStatus[] = INVOICE_DISPLAY_STATUSES,
): StatusBucket[] {
  return order.map((status) => ({
    status,
    count: tallies[status].count,
    totalsByCurrency: tallies[status].totalsByCurrency,
  }));
}
