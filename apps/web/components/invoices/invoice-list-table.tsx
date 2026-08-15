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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDateCs, formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";
import {
  INVOICE_SORT_KEYS,
  parseInvoiceSort,
  serializeInvoiceSort,
  type InvoiceSortKey,
} from "@/lib/invoices/list-query";
import { DISPLAY_STATUS_ROW_ACCENT } from "@/lib/invoice-status-ui";
import { cn } from "@/lib/utils";
import { InvoiceOriginProviderSchema } from "@invoicey/invoice-core/import";
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
import { useTranslations, useLocale } from "next-intl";
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
  paymentState: string;
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
  const t = useTranslations("Invoices.list");
  const tOrigin = useTranslations("Invoices.origin");
  const locale = useLocale() as AppLocale;
  const [params, setParams] = useQueryStates(
    {
      status: parseAsString,
      issuerId: parseAsString,
      clientId: parseAsString,
      originProvider: parseAsString,
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
      originProvider?: string;
      q?: string;
      from?: string;
      to?: string;
    }) => {
      setRowSelection({});
      void setParams({
        status: next.status ?? null,
        issuerId: next.issuerId ?? null,
        clientId: next.clientId ?? null,
        originProvider: next.originProvider ?? null,
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
          <DataGridColumnHeader column={column} title={t("number")} />
        ),
        cell: ({ row }) => (
          <div className="truncate pr-2 font-medium tabular-nums">
            <Link
              className="underline-offset-4 hover:underline"
              href={`/invoices/${row.original.id}`}
              title={row.original.number ?? t("untitledDraft")}
            >
              {row.original.number ?? t("draft")}
            </Link>
            {row.original.importCompleteness === "archive" ? (
              <span className="text-muted-foreground ml-2 text-[0.65rem] uppercase tracking-wide">
                {t("archive")}
              </span>
            ) : null}
          </div>
        ),
        meta: { headerTitle: t("number") },
        size: 105,
      },
      {
        id: "originProvider",
        accessorFn: (row) => row.originProvider ?? "invoicey",
        enableSorting: false,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("source")} />
        ),
        cell: ({ row }) => {
          const provider = row.original.originProvider ?? "invoicey";
          const parsed = InvoiceOriginProviderSchema.safeParse(provider);
          const label = parsed.success ? tOrigin(parsed.data) : provider;
          return <span className="text-muted-foreground text-xs">{label}</span>;
        },
        meta: { headerTitle: t("source") },
        size: 110,
      },
      {
        accessorKey: "issueDate",
        id: "issueDate",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("issued")} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatDateCs(row.original.issueDate, locale)}
          </span>
        ),
        meta: { headerTitle: t("issued") },
        size: 84,
      },
      {
        accessorKey: "dueDate",
        id: "dueDate",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("due")} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatDateCs(row.original.dueDate, locale)}
          </span>
        ),
        meta: { headerTitle: t("due") },
        size: 84,
      },
      {
        accessorKey: "clientName",
        id: "clientName",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("client")} />
        ),
        meta: { headerTitle: t("client"), cellClassName: "truncate" },
        size: 100,
      },
      {
        accessorKey: "total",
        id: "total",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("total")} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(
              Number(row.original.total) || 0,
              row.original.currency || "CZK",
              locale,
            )}
          </span>
        ),
        meta: { headerTitle: t("total") },
        size: 94,
      },
      {
        accessorKey: "displayStatus",
        id: "displayStatus",
        enableSorting: false,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("status")} />
        ),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1">
            <InvoiceStatusBadge status={row.original.displayStatus} />
            {row.original.paymentState === "partial" ||
            row.original.paymentState === "overpaid" ? (
              <Badge variant="outline">{row.original.paymentState}</Badge>
            ) : null}
          </div>
        ),
        meta: { headerTitle: t("status") },
        size: 64,
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">{t("actions")}</span>,
        cell: ({ row }) => <InvoiceRowActions row={row.original} />,
        meta: {
          headerTitle: t("actions"),
          headerClassName: "text-right",
          cellClassName: "pr-2",
        },
        size: 120,
      },
    ],
    [t, tOrigin, locale],
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
  const selectedDeletable = selectedRows.filter(
    (r) => r.displayStatus === "draft" || r.displayStatus === "cancelled",
  ).length;
  const selectedCancellable = selectedRows.filter(
    (r) =>
      (r.displayStatus === "unpaid" ||
        r.displayStatus === "overdue" ||
        r.displayStatus === "future") &&
      r.paymentState === "unpaid",
  ).length;
  const hasProtectedIssuedSelection = selectedDeletable < selectedIds.length;

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
        originProvider={params.originProvider ?? undefined}
        q={params.q ?? undefined}
        status={params.status ?? undefined}
        to={params.to ?? undefined}
      />

      <div className="space-y-3 md:hidden">
        {rows.length > 0 ? (
          rows.map((row) => <InvoiceMobileCard key={row.id} row={row} />)
        ) : (
          <p className="text-muted-foreground rounded-md border px-4 py-8 text-center text-sm">
            {t("empty")}{" "}
            <Link className="text-primary underline" href="/invoices/new">
              {t("createFirst")}
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
              {t("previous")}
            </Button>
            <span className="text-muted-foreground text-xs">
              {t("pageMobile", {
                current: String(params.page),
                total: String(Math.ceil(total / params.pageSize)),
              })}
            </span>
            <Button
              disabled={params.page * params.pageSize >= total}
              onClick={() => void setParams({ page: params.page + 1 })}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("next")}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="hidden min-w-0 md:block">
        <AppDataGrid
          emptyMessage={t("empty")}
          recordCount={total}
          table={table}
        />
      </div>

      {barVisible ? (
        <div className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <span className="font-medium tabular-nums">
                {t("selected", { count: String(selectedIds.length) })}
              </span>
              <span className="text-muted-foreground">
                {" "}
                · {formatMoney(selectedTotal, "CZK", locale)}
                {selectedDrafts > 0
                  ? ` · ${t("selectedDrafts", { count: selectedDrafts })}`
                  : null}
              </span>
              {hasProtectedIssuedSelection ? (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t("deleteIssuedHint")}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending || selectedDrafts === 0}
                loading={pending && bulkKey === "issue"}
                onClick={() => runBulk("issue", bulkIssueInvoice)}
                size="sm"
                type="button"
              >
                {pending && bulkKey === "issue" ? t("issuing") : t("bulkIssue")}
              </Button>
              <Button
                disabled={pending}
                loading={pending && bulkKey === "paid"}
                onClick={() => runBulk("paid", bulkMarkInvoicePaid)}
                size="sm"
                type="button"
                variant="secondary"
              >
                {pending && bulkKey === "paid" ? t("saving") : t("bulkPaid")}
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
                  ? t("saving")
                  : t("bulkUnpaid")}
              </Button>
              <Button
                disabled={pending || selectedCancellable === 0}
                loading={pending && bulkKey === "cancel"}
                onClick={() => runBulk("cancel", bulkCancelInvoice)}
                size="sm"
                type="button"
                variant="secondary"
              >
                {pending && bulkKey === "cancel"
                  ? t("cancelling")
                  : t("bulkCancel")}
              </Button>
              <Button
                disabled={pending || selectedDeletable === 0}
                loading={pending && bulkKey === "delete"}
                onClick={() => runBulk("delete", bulkDeleteInvoice)}
                size="sm"
                type="button"
                variant="destructive"
              >
                {pending && bulkKey === "delete"
                  ? t("deleting")
                  : t("bulkDelete")}
              </Button>
              <Button
                disabled={pending}
                onClick={() => setRowSelection({})}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t("cancelSelection")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InvoiceMobileCard({ row }: { row: InvoiceListRow }) {
  const t = useTranslations("Invoices.list");
  const locale = useLocale() as AppLocale;
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
            {row.number ?? t("untitledDraft")}
          </Link>
          <p className="text-muted-foreground truncate text-sm">
            {row.clientName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <InvoiceStatusBadge status={row.displayStatus} />
          {row.paymentState === "partial" || row.paymentState === "overpaid" ? (
            <Badge variant="outline">{row.paymentState}</Badge>
          ) : null}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">{t("issued")}</dt>
          <dd className="tabular-nums">
            {formatDateCs(row.issueDate, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{t("due")}</dt>
          <dd className="tabular-nums">{formatDateCs(row.dueDate, locale)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground text-xs">{t("total")}</dt>
          <dd className="font-medium tabular-nums">
            {formatMoney(Number(row.total) || 0, row.currency || "CZK", locale)}
          </dd>
        </div>
      </dl>
      <InvoiceRowActions row={row} />
    </article>
  );
}

function InvoiceRowActions({ row }: { row: InvoiceListRow }) {
  const t = useTranslations("Invoices.list");
  return (
    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
      {row.displayStatus === "draft" ? (
        <form action={issueSavedInvoice}>
          <input name="id" type="hidden" value={row.id} />
          <SubmitButton pendingLabel={t("issuing")} size="sm">
            <StampIcon />
            {t("issue")}
          </SubmitButton>
        </form>
      ) : (
        <Button
          render={<Link href={`/invoices/${row.id}`} prefetch />}
          size="sm"
          variant="ghost"
        >
          <EyeIcon />
          {t("detail")}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("moreActions", {
                number: row.number ?? t("untitledDraft"),
              })}
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
                {t("detailInvoice")}
              </DropdownMenuItem>
              <DropdownMenuItem
                render={<Link href={`/invoices/${row.id}/edit`} prefetch />}
              >
                <PencilIcon />
                {t("editDraft")}
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem
            render={<a download href={`/api/invoices/${row.id}/pdf`} />}
          >
            <FileDownIcon />
            {t("downloadPdf")}
          </DropdownMenuItem>
          <InvoiceActionMenuForm
            action={duplicateInvoice}
            icon={<CopyIcon />}
            id={row.id}
            label={t("duplicate")}
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
                label={t("markPaidFull")}
              />
              <InvoiceActionMenuForm
                action={cancelInvoice}
                icon={<XCircleIcon />}
                id={row.id}
                label={t("cancelInvoice")}
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
                label={t("unmarkPaid")}
              />
            </>
          ) : null}
          {row.displayStatus === "draft" ||
          row.displayStatus === "cancelled" ? (
            <>
              <DropdownMenuSeparator />
              <InvoiceActionMenuForm
                action={deleteInvoice}
                icon={<Trash2Icon />}
                id={row.id}
                label={t("deleteDraft")}
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
