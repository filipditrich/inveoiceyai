import { InvoiceListTable } from "@/components/invoices/invoice-list-table";
import { InvoiceStatusSummary } from "@/components/invoices/invoice-status-summary";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import {
  buildInvoiceBaseConditions,
  invoiceOrderBy,
  parseInvoiceSort,
  parsePage,
  parsePageSize,
  serializeInvoiceSort,
} from "@/lib/invoices/list-query";
import { displayStatusWhere, pragueTodayIso } from "@/lib/invoice-status-sql";
import { loadClientOptions, loadIssuerOptions } from "@/lib/load-parties";
import {
  INVOICE_DISPLAY_STATUSES,
  normalizeDisplayStatusParam,
  resolveDisplayStatus,
  type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";
import { invoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, count } from "drizzle-orm";
import Link from "next/link";

type Search = Promise<{
  invalid?: string;
  toast?: string;
  ok?: string;
  skipped?: string;
  failed?: string;
  status?: string;
  issuerId?: string;
  clientId?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
}>;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const sp = await searchParams;
  const { workspaceId } = await requireWorkspace();
  const page = parsePage(sp.page);
  const pageSize = parsePageSize(sp.pageSize);
  const sort = parseInvoiceSort(sp.sort);
  const todayIso = pragueTodayIso();
  const statusFilter = normalizeDisplayStatusParam(sp.status);

  const baseConditions = buildInvoiceBaseConditions(workspaceId, sp);
  const listConditions = [...baseConditions];
  if (statusFilter) {
    const pred = displayStatusWhere(statusFilter, todayIso);
    if (pred) {
      listConditions.push(pred);
    }
  }

  const whereClause = and(...listConditions);
  const summaryWhere = and(...baseConditions);

  const [totalRow] = await db
    .select({ value: count() })
    .from(invoices)
    .where(whereClause);
  const total = Number(totalRow?.value ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, pageCount);
  const offset = (safePage - 1) * pageSize;

  const [rows, summaryRows, issuers, clients] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(whereClause)
      .orderBy(...invoiceOrderBy(sort))
      .limit(pageSize)
      .offset(offset),
    db.select().from(invoices).where(summaryWhere),
    loadIssuerOptions(workspaceId),
    loadClientOptions(workspaceId),
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
  for (const row of summaryRows) {
    const display = resolveDisplayStatus(
      {
        issuedAt: row.issuedAt,
        dueDate: row.dueDate,
        paidAt: row.paidAt,
        cancelledAt: row.cancelledAt,
        issueDate: row.issueDate,
      },
      todayIso,
    );
    tally[display].count += 1;
    tally[display].total += Number(row.total) || 0;
  }
  const summaryBuckets = INVOICE_DISPLAY_STATUSES.map((status) => ({
    status,
    count: tally[status].count,
    total: tally[status].total,
  }));

  const pageItems = rows.map((row) => ({
    id: row.id,
    number: row.number,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    clientName: row.clientName,
    total: String(row.total),
    currency: row.currency,
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
    importCompleteness: row.importCompleteness,
    originProvider: row.originProvider,
  }));

  const filterBase = {
    issuerId: sp.issuerId,
    clientId: sp.clientId,
    q: sp.q,
    from: sp.from,
    to: sp.to,
    sort: serializeInvoiceSort(sort),
    pageSize: String(pageSize),
  };

  const issuerOptions = issuers.map((i) => ({
    id: i.id,
    name: i.snapshot.name,
  }));
  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.snapshot.name,
  }));

  return (
    <div className="@container/main space-y-4 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Vystavené faktury
          </h1>
          <p className="text-muted-foreground">
            Stavy, filtry a akce nad fakturami.
          </p>
        </div>
        <div className="flex gap-2">
          <Button render={<Link href="/invoices/new" prefetch />} size="sm">
            + Vystavit fakturu
          </Button>
          <Button
            render={<Link href="/invoices/import" prefetch />}
            size="sm"
            variant="outline"
          >
            Import
          </Button>
          <Button
            render={<Link href="/invoices/from-json" prefetch />}
            size="sm"
            variant="outline"
          >
            From JSON
          </Button>
        </div>
      </div>

      {sp.invalid ? (
        <p className="text-destructive text-sm">Chyba: {sp.invalid}</p>
      ) : null}
      {sp.toast?.startsWith("bulk_") ? (
        <p className="text-muted-foreground text-sm">
          Hromadná akce: {sp.ok ?? "0"} ok, {sp.skipped ?? "0"} přeskočeno,{" "}
          {sp.failed ?? "0"} chyb.
        </p>
      ) : null}

      <InvoiceStatusSummary
        activeStatus={statusFilter}
        buckets={summaryBuckets}
        filterBase={filterBase}
      />

      <InvoiceListTable
        clients={clientOptions}
        issuers={issuerOptions}
        rows={pageItems}
        total={total}
      />
    </div>
  );
}
