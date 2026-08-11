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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SubmitButton } from "@/components/ui/submit-button";
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
  CopyIcon,
  EllipsisIcon,
  EyeIcon,
  FileDownIcon,
  PencilIcon,
  RotateCcwIcon,
  StampIcon,
  Trash2Icon,
  WalletCardsIcon,
  XCircleIcon,
} from "lucide-react";
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
import {
  type ReactNode,
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";

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

type BulkKey = "issue" | "paid" | "unpaid" | "cancel" | "delete" | null;

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
  const [bulkKey, setBulkKey] = useState<BulkKey>(null);

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
        size: 36,
      },
      {
        accessorKey: "number",
        id: "number",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Číslo" />
        ),
        cell: ({ row }) => (
          <div className="truncate pr-2 font-medium tabular-nums">
            <Link
              className="underline-offset-4 hover:underline"
              href={`/invoices/${row.original.id}`}
              title={row.original.number ?? "Návrh bez čísla"}
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
        size: 105,
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
        size: 84,
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
        size: 84,
      },
      {
        accessorKey: "clientName",
        id: "clientName",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Klient" />
        ),
        meta: { headerTitle: "Klient", cellClassName: "truncate" },
        size: 100,
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
        size: 94,
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
        size: 64,
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">Akce</span>,
        cell: ({ row }) => <InvoiceRowActions row={row.original} />,
        meta: {
          headerTitle: "Akce",
          headerClassName: "text-right",
          cellClassName: "pr-2",
        },
        size: 120,
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

  const runBulk = (
    key: Exclude<BulkKey, null>,
    action: (fd: FormData) => Promise<void>,
  ) => {
    const fd = new FormData();
    for (const id of selectedIds) {
      fd.append("ids", id);
    }
    setBulkKey(key);
    startTransition(async () => {
      try {
        await action(fd);
      } finally {
        setBulkKey(null);
      }
    });
  };

  const barVisible = selectedIds.length > 0;

  return (
    <div className={cn("space-y-3", barVisible && "pb-24")}>
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

      <div className="space-y-3 md:hidden">
        {rows.length > 0 ? (
          rows.map((row) => <InvoiceMobileCard key={row.id} row={row} />)
        ) : (
          <p className="text-muted-foreground rounded-md border px-4 py-8 text-center text-sm">
            Žádné faktury.{" "}
            <Link className="text-primary underline" href="/invoices/new">
              Vytvořit první fakturu
            </Link>
            .
          </p>
        )}
        {total > params.pageSize ? (
          <div className="flex items-center justify-between gap-3">
            <Button
              disabled={params.page <= 1}
              onClick={() => void setParams({ page: params.page - 1 })}
              size="sm"
              type="button"
              variant="outline"
            >
              Předchozí
            </Button>
            <span className="text-muted-foreground text-xs">
              Strana {params.page} z {Math.ceil(total / params.pageSize)}
            </span>
            <Button
              disabled={params.page * params.pageSize >= total}
              onClick={() => void setParams({ page: params.page + 1 })}
              size="sm"
              type="button"
              variant="outline"
            >
              Další
            </Button>
          </div>
        ) : null}
      </div>

      <div className="hidden min-w-0 md:block">
        <AppDataGrid
          emptyMessage="Žádné faktury."
          recordCount={total}
          table={table}
        />
      </div>

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
                  ? ` · ${selectedDrafts} ${selectedDrafts === 1 ? "návrh" : selectedDrafts >= 2 && selectedDrafts <= 4 ? "návrhy" : "návrhů"}`
                  : null}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending || selectedDrafts === 0}
                loading={pending && bulkKey === "issue"}
                onClick={() => runBulk("issue", bulkIssueInvoice)}
                size="sm"
                type="button"
              >
                {pending && bulkKey === "issue" ? "Vystavuji…" : "Vystavit"}
              </Button>
              <Button
                disabled={pending}
                loading={pending && bulkKey === "paid"}
                onClick={() => runBulk("paid", bulkMarkInvoicePaid)}
                size="sm"
                type="button"
                variant="secondary"
              >
                {pending && bulkKey === "paid" ? "Ukládám…" : "Zaplaceno"}
              </Button>
              <Button
                disabled={pending}
                loading={pending && bulkKey === "unpaid"}
                onClick={() => runBulk("unpaid", bulkUnmarkInvoicePaid)}
                size="sm"
                type="button"
                variant="secondary"
              >
                {pending && bulkKey === "unpaid"
                  ? "Ukládám…"
                  : "Zrušit zaplaceno"}
              </Button>
              <Button
                disabled={pending}
                loading={pending && bulkKey === "cancel"}
                onClick={() => runBulk("cancel", bulkCancelInvoice)}
                size="sm"
                type="button"
                variant="secondary"
              >
                {pending && bulkKey === "cancel" ? "Stornuji…" : "Stornovat"}
              </Button>
              <Button
                disabled={pending}
                loading={pending && bulkKey === "delete"}
                onClick={() => runBulk("delete", bulkDeleteInvoice)}
                size="sm"
                type="button"
                variant="destructive"
              >
                {pending && bulkKey === "delete" ? "Mazání…" : "Smazat návrhy"}
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

function InvoiceMobileCard({ row }: { row: InvoiceListRow }) {
  return (
    <article
      className={cn(
        "bg-card space-y-3 rounded-lg border border-l-4 p-4",
        DISPLAY_STATUS_ROW_ACCENT[row.displayStatus],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            className="font-semibold tabular-nums underline-offset-4 hover:underline"
            href={`/invoices/${row.id}`}
          >
            {row.number ?? "Návrh bez čísla"}
          </Link>
          <p className="text-muted-foreground truncate text-sm">
            {row.clientName}
          </p>
        </div>
        <InvoiceStatusBadge status={row.displayStatus} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">Vystaveno</dt>
          <dd className="tabular-nums">{formatDateCs(row.issueDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Splatnost</dt>
          <dd className="tabular-nums">{formatDateCs(row.dueDate)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground text-xs">Celkem</dt>
          <dd className="font-medium tabular-nums">
            {formatMoney(Number(row.total) || 0, row.currency || "CZK")}
          </dd>
        </div>
      </dl>
      <InvoiceRowActions row={row} />
    </article>
  );
}

function InvoiceRowActions({ row }: { row: InvoiceListRow }) {
  return (
    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
      {row.displayStatus === "draft" ? (
        <form action={issueSavedInvoice}>
          <input name="id" type="hidden" value={row.id} />
          <SubmitButton pendingLabel="Vystavuji…" size="sm">
            <StampIcon />
            Vystavit
          </SubmitButton>
        </form>
      ) : (
        <Button
          render={<Link href={`/invoices/${row.id}`} prefetch />}
          size="sm"
          variant="ghost"
        >
          <EyeIcon />
          Detail
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Další akce pro ${row.number ?? "návrh"}`}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48" sideOffset={6}>
          {row.displayStatus === "draft" ? (
            <>
              <DropdownMenuItem
                render={<Link href={`/invoices/${row.id}`} prefetch />}
              >
                <EyeIcon />
                Detail faktury
              </DropdownMenuItem>
              <DropdownMenuItem
                render={<Link href={`/invoices/${row.id}/edit`} prefetch />}
              >
                <PencilIcon />
                Upravit návrh
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem
            render={<a download href={`/api/invoices/${row.id}/pdf`} />}
          >
            <FileDownIcon />
            Stáhnout PDF
          </DropdownMenuItem>
          <InvoiceActionMenuForm
            action={duplicateInvoice}
            icon={<CopyIcon />}
            id={row.id}
            label="Duplikovat"
          />

          {row.displayStatus === "unpaid" ||
          row.displayStatus === "overdue" ||
          row.displayStatus === "future" ? (
            <>
              <DropdownMenuSeparator />
              <InvoiceActionMenuForm
                action={markInvoicePaid}
                icon={<WalletCardsIcon />}
                id={row.id}
                label="Označit jako zaplacenou"
              />
              <InvoiceActionMenuForm
                action={cancelInvoice}
                icon={<XCircleIcon />}
                id={row.id}
                label="Stornovat fakturu"
              />
            </>
          ) : null}
          {row.displayStatus === "paid" ? (
            <>
              <DropdownMenuSeparator />
              <InvoiceActionMenuForm
                action={unmarkInvoicePaid}
                icon={<RotateCcwIcon />}
                id={row.id}
                label="Zrušit zaplacení"
              />
            </>
          ) : null}
          {row.displayStatus === "draft" ? (
            <>
              <DropdownMenuSeparator />
              <InvoiceActionMenuForm
                action={deleteInvoice}
                icon={<Trash2Icon />}
                id={row.id}
                label="Smazat návrh"
                variant="destructive"
              />
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function InvoiceActionMenuForm({
  action,
  icon,
  id,
  label,
  variant = "default",
}: {
  action: (formData: FormData) => Promise<void>;
  icon: ReactNode;
  id: string;
  label: string;
  variant?: "default" | "destructive";
}) {
  return (
    <form action={action}>
      <input name="id" type="hidden" value={id} />
      <DropdownMenuItem
        className="w-full"
        nativeButton
        render={<button type="submit" />}
        variant={variant}
      >
        {icon}
        {label}
      </DropdownMenuItem>
    </form>
  );
}
