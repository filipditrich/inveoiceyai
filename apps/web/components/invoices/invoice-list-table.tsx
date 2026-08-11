"use client";

import {
  bulkCancelInvoice,
  bulkDeleteInvoice,
  bulkIssueInvoice,
  bulkMarkInvoicePaid,
  bulkUnmarkInvoicePaid,
  cancelInvoice,
  deleteInvoice,
  duplicateInvoice,
  issueSavedInvoice,
  markInvoicePaid,
  unmarkInvoicePaid,
} from "@/actions/invoices";
import { AppDataGrid } from "@/components/data-grid/app-data-grid";
import {
  InvoiceListFilters,
  type PartyOption,
} from "@/components/invoices/invoice-list-filters";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import {
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table";
import { Button } from "@/components/ui/button";
import { formatDateCs, formatMoney } from "@/lib/format";
import {
  INVOICE_SORT_KEYS,
  parseInvoiceSort,
  serializeInvoiceSort,
  type InvoiceSortKey,
} from "@/lib/invoices/list-query";
import { DISPLAY_STATUS_ROW_ACCENT } from "@/lib/invoice-status-ui";
import { cn } from "@/lib/utils";
import type { InvoiceDisplayStatus } from "@invoicey/invoice-core/status-display";
import {
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import Link from "next/link";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useMemo, useState, useTransition } from "react";

export type InvoiceListRow = {
  id: string;
  number: string | null;
  issueDate: string;
  dueDate: string;
  clientName: string;
  total: string;
  currency: string;
  displayStatus: InvoiceDisplayStatus;
  importCompleteness?: string | null;
  originProvider?: string | null;
};

const SORT_KEY_SET = new Set<string>(INVOICE_SORT_KEYS);

function sortingFromParam(sort: string | null): SortingState {
  const parsed = parseInvoiceSort(sort);
  return [{ id: parsed.id, desc: parsed.desc }];
}

function sortParamFromSorting(sorting: SortingState): string {
  const first = sorting[0];
  if (!first || !SORT_KEY_SET.has(first.id)) {
    return serializeInvoiceSort({ id: "issueDate", desc: true });
  }
  return serializeInvoiceSort({
    id: first.id as InvoiceSortKey,
    desc: Boolean(first.desc),
  });
}

type InvoiceListTableProps = {
  rows: InvoiceListRow[];
  total: number;
  issuers: PartyOption[];
  clients: PartyOption[];
};

export function InvoiceListTable({
  rows,
  total,
  issuers,
  clients,
}: InvoiceListTableProps) {
  const [params, setParams] = useQueryStates(
    {
      status: parseAsString,
      issuerId: parseAsString,
      clientId: parseAsString,
      q: parseAsString,
      from: parseAsString,
      to: parseAsString,
      sort: parseAsString.withDefault("issueDate.desc"),
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(50),
    },
    { history: "push", shallow: false },
  );

  const sorting = useMemo(() => sortingFromParam(params.sort), [params.sort]);
  const pagination = useMemo<PaginationState>(
    () => ({
      pageIndex: Math.max(0, params.page - 1),
      pageSize: params.pageSize,
    }),
    [params.page, params.pageSize],
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({});
  const [pending, startTransition] = useTransition();

  const onFiltersChange = useCallback(
    (next: {
      status?: string;
      issuerId?: string;
      clientId?: string;
      q?: string;
      from?: string;
      to?: string;
    }) => {
      setRowSelection({});
      void setParams({
        status: next.status ?? null,
        issuerId: next.issuerId ?? null,
        clientId: next.clientId ?? null,
        q: next.q ?? null,
        from: next.from ?? null,
        to: next.to ?? null,
        page: 1,
      });
    },
    [setParams],
  );

  const columns = useMemo<ColumnDef<DataGridFeatures, InvoiceListRow>[]>(
    () => [
      {
        id: "select",
        header: () => <DataGridTableRowSelectAll />,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        accessorKey: "number",
        id: "number",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Číslo" />
        ),
        cell: ({ row }) => (
          <div className="font-medium tabular-nums">
            <Link
              className="underline-offset-4 hover:underline"
              href={`/invoices/${row.original.id}`}
            >
              {row.original.number ?? "DRAFT"}
            </Link>
            {row.original.importCompleteness === "archive" ? (
              <span className="text-muted-foreground ml-2 text-[0.65rem] uppercase tracking-wide">
                archiv
              </span>
            ) : null}
            {row.original.originProvider ? (
              <span className="text-muted-foreground ml-2 text-[0.65rem]">
                · {row.original.originProvider}
              </span>
            ) : null}
          </div>
        ),
        meta: { headerTitle: "Číslo" },
      },
      {
        accessorKey: "issueDate",
        id: "issueDate",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Vystaveno" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatDateCs(row.original.issueDate)}
          </span>
        ),
        meta: { headerTitle: "Vystaveno" },
      },
      {
        accessorKey: "dueDate",
        id: "dueDate",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Splatnost" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatDateCs(row.original.dueDate)}
          </span>
        ),
        meta: { headerTitle: "Splatnost" },
      },
      {
        accessorKey: "clientName",
        id: "clientName",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Klient" />
        ),
        meta: { headerTitle: "Klient", autoSize: true },
      },
      {
        accessorKey: "total",
        id: "total",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Celkem" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(
              Number(row.original.total) || 0,
              row.original.currency || "CZK",
            )}
          </span>
        ),
        meta: { headerTitle: "Celkem" },
      },
      {
        accessorKey: "displayStatus",
        id: "displayStatus",
        enableSorting: false,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Stav" />
        ),
        cell: ({ row }) => (
          <InvoiceStatusBadge status={row.original.displayStatus} />
        ),
        meta: { headerTitle: "Stav" },
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">Akce</span>,
        cell: ({ row }) => <InvoiceRowActions row={row.original} />,
        meta: { headerTitle: "Akce", headerClassName: "text-right" },
        size: 280,
      },
    ],
    [],
  );

  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnVisibility,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    manualPagination: true,
    manualSorting: true,
    rowCount: total,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setRowSelection({});
      void setParams({
        sort: sortParamFromSorting(next),
        page: 1,
      });
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(pagination) : updater;
      setRowSelection({});
      void setParams({
        page: next.pageIndex + 1,
        pageSize: next.pageSize,
      });
    },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
  });

  const selectedIds = Object.keys(rowSelection).filter(
    (id) => rowSelection[id],
  );
  const selectedRows = rows.filter((r) => selectedIds.includes(r.id));
  const selectedTotal = selectedRows.reduce(
    (sum, r) => sum + (Number(r.total) || 0),
    0,
  );
  const selectedDrafts = selectedRows.filter(
    (r) => r.displayStatus === "draft",
  ).length;

  const runBulk = (action: (fd: FormData) => Promise<void>) => {
    const fd = new FormData();
    for (const id of selectedIds) {
      fd.append("ids", id);
    }
    startTransition(async () => {
      await action(fd);
    });
  };

  const barVisible = selectedIds.length > 0;

  return (
    <div className={cn("space-y-3", barVisible && "pb-24")}>
      <AppDataGrid
        emptyMessage={
          <p className="text-muted-foreground py-8 text-center text-sm">
            Žádné faktury.{" "}
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="/invoices/new"
            >
              Vytvořit první fakturu
            </Link>
            .
          </p>
        }
        recordCount={total}
        table={table}
        toolbar={
          <InvoiceListFilters
            clientId={params.clientId ?? undefined}
            clients={clients}
            from={params.from ?? undefined}
            issuerId={params.issuerId ?? undefined}
            issuers={issuers}
            onFiltersChange={onFiltersChange}
            q={params.q ?? undefined}
            status={params.status ?? undefined}
            to={params.to ?? undefined}
          />
        }
      />

      {barVisible ? (
        <div className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <span className="font-medium tabular-nums">
                {selectedIds.length} vybraných
              </span>
              <span className="text-muted-foreground">
                {" "}
                · {formatMoney(selectedTotal)}
                {selectedDrafts > 0
                  ? ` · ${selectedDrafts} draft${selectedDrafts === 1 ? "" : "y"}`
                  : null}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending || selectedDrafts === 0}
                onClick={() => runBulk(bulkIssueInvoice)}
                size="sm"
                type="button"
              >
                Vystavit
              </Button>
              <Button
                disabled={pending}
                onClick={() => runBulk(bulkMarkInvoicePaid)}
                size="sm"
                type="button"
                variant="secondary"
              >
                Zaplaceno
              </Button>
              <Button
                disabled={pending}
                onClick={() => runBulk(bulkUnmarkInvoicePaid)}
                size="sm"
                type="button"
                variant="secondary"
              >
                Zrušit zaplaceno
              </Button>
              <Button
                disabled={pending}
                onClick={() => runBulk(bulkCancelInvoice)}
                size="sm"
                type="button"
                variant="secondary"
              >
                Stornovat
              </Button>
              <Button
                disabled={pending}
                onClick={() => runBulk(bulkDeleteInvoice)}
                size="sm"
                type="button"
                variant="destructive"
              >
                Smazat návrhy
              </Button>
              <Button
                disabled={pending}
                onClick={() => setRowSelection({})}
                size="sm"
                type="button"
                variant="ghost"
              >
                Zrušit výběr
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InvoiceRowActions({ row }: { row: InvoiceListRow }) {
  return (
    <div
      className={cn(
        "flex flex-wrap justify-end gap-1",
        DISPLAY_STATUS_ROW_ACCENT[row.displayStatus],
      )}
    >
      <Button
        render={<Link href={`/invoices/${row.id}`} prefetch />}
        size="sm"
        variant="ghost"
      >
        Detail
      </Button>
      {row.displayStatus === "draft" ? (
        <>
          <form action={issueSavedInvoice}>
            <input name="id" type="hidden" value={row.id} />
            <Button size="sm" type="submit">
              Vystavit
            </Button>
          </form>
          <Button
            render={<Link href={`/invoices/${row.id}/edit`} prefetch />}
            size="sm"
            variant="outline"
          >
            Upravit
          </Button>
        </>
      ) : null}
      <Button
        render={<a download href={`/api/invoices/${row.id}/pdf`} />}
        size="sm"
        variant="ghost"
      >
        PDF
      </Button>
      <form action={duplicateInvoice}>
        <input name="id" type="hidden" value={row.id} />
        <Button size="sm" type="submit" variant="ghost">
          Dup
        </Button>
      </form>
      {row.displayStatus === "unpaid" ||
      row.displayStatus === "overdue" ||
      row.displayStatus === "future" ? (
        <>
          <form action={markInvoicePaid}>
            <input name="id" type="hidden" value={row.id} />
            <Button size="sm" type="submit" variant="ghost">
              Zaplaceno
            </Button>
          </form>
          <form action={cancelInvoice}>
            <input name="id" type="hidden" value={row.id} />
            <Button size="sm" type="submit" variant="ghost">
              Storno
            </Button>
          </form>
        </>
      ) : null}
      {row.displayStatus === "paid" ? (
        <form action={unmarkInvoicePaid}>
          <input name="id" type="hidden" value={row.id} />
          <Button size="sm" type="submit" variant="ghost">
            Zrušit zapl.
          </Button>
        </form>
      ) : null}
      {row.displayStatus === "draft" ? (
        <form action={deleteInvoice}>
          <input name="id" type="hidden" value={row.id} />
          <Button size="sm" type="submit" variant="destructive">
            Smazat
          </Button>
        </form>
      ) : null}
    </div>
  );
}
