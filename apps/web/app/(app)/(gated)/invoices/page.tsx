import { AssistantOpenButton } from "@/components/assistant/assistant-open-button";
import { InvoiceListTable } from "@/components/invoices/invoice-list-table";
import { InvoiceStatusSummary } from "@/components/invoices/invoice-status-summary";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import { displayStatusWhere, pragueTodayIso } from "@/lib/invoice-status-sql";
import {
  buildInvoiceBaseConditions,
  invoiceOrderBy,
  parsePage,
  parsePageSize,
} from "@/lib/invoices/list-query";
import {
  parseInvoiceSort,
  serializeInvoiceSort,
} from "@/lib/invoices/list-sort";
import {
  loadInvoiceStatusTallies,
  toStatusBuckets,
} from "@/lib/invoices/status-summary";
import { loadClientOptions, loadIssuerOptions } from "@/lib/load-parties";
import { and, count } from "drizzle-orm";
import { FilesIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { invoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  normalizeDisplayStatusParam,
  resolveDisplayStatus,
} from "@invoicey/invoice-core/status-display";

type Search = Promise<{
  invalid?: string;
  toast?: string;
  ok?: string;
  skipped?: string;
  failed?: string;
  status?: string;
  issuerId?: string;
  clientId?: string;
  originProvider?: string;
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
  const [sp, t, tErrors, tToasts, { workspaceId }] = await Promise.all([
    searchParams,
    getTranslations("Invoices.list"),
    getTranslations("Errors.invalid"),
    getTranslations("Toasts"),
    requireWorkspace(),
  ]);
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
  const offset = (page - 1) * pageSize;

  const [totalRows, rows, tallies, issuers, clients] = await Promise.all([
    db.select({ value: count() }).from(invoices).where(whereClause),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        issuedAt: invoices.issuedAt,
        paidAt: invoices.paidAt,
        cancelledAt: invoices.cancelledAt,
        clientName: invoices.clientName,
        total: invoices.total,
        currency: invoices.currency,
        paymentState: invoices.paymentState,
        importCompleteness: invoices.importCompleteness,
        originProvider: invoices.originProvider,
      })
      .from(invoices)
      .where(whereClause)
      .orderBy(...invoiceOrderBy(sort))
      .limit(pageSize)
      .offset(offset),
    loadInvoiceStatusTallies(baseConditions, todayIso),
    loadIssuerOptions(workspaceId),
    loadClientOptions(workspaceId),
  ]);
  const total = Number(totalRows[0]?.value ?? 0);

  const summaryBuckets = toStatusBuckets(tallies);

  const pageItems = rows.map((row) => ({
    id: row.id,
    number: row.number,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    clientName: row.clientName,
    total: String(row.total),
    currency: row.currency,
    paymentState: row.paymentState,
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
    originProvider: sp.originProvider,
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
    <div className="@container/main space-y-4">
      <PageHeader
        actions={
          <>
            <AssistantOpenButton size="sm">{t("aiButton")}</AssistantOpenButton>
            <Button
              render={<Link href="/invoices/new" prefetch />}
              size="sm"
              variant="outline"
            >
              {t("newButton")}
            </Button>
            <Button
              render={<Link href="/invoices/import" prefetch />}
              size="sm"
              variant="outline"
            >
              {t("importButton")}
            </Button>
            <Button
              render={<Link href="/invoices/from-json" prefetch />}
              size="sm"
              variant="outline"
            >
              {t("fromJsonButton")}
            </Button>
          </>
        }
        description={t("subtitle")}
        icon={<FilesIcon />}
        title={t("title")}
      />

      {sp.invalid ? (
        <p className="text-sm text-destructive">
          {tErrors("generic", { code: sp.invalid })}
        </p>
      ) : null}
      {sp.toast?.startsWith("bulk_") ? (
        <p className="text-sm text-muted-foreground">
          {tToasts("bulk_summary", {
            ok: String(Number(sp.ok) || 0),
            skipped: String(Number(sp.skipped) || 0),
            failed: String(Number(sp.failed) || 0),
          })}
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
