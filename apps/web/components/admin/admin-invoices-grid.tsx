"use client";

import { useMemo, useState } from "react";
import { AdminCopyId } from "@/components/admin/admin-copy-id";
import { AppDataGrid } from "@/components/data-grid/app-data-grid";
import {
  AppFilters,
  filtersFromRecord,
  recordFromFilters,
} from "@/components/data-grid/app-filters";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import {
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { formatInvoiceDate, formatMoney } from "@/lib/format";
import {
  useTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { Building2Icon, SearchIcon, WarehouseIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import {
  DISPLAY_STATUS_LABELS,
  INVOICE_DISPLAY_STATUSES,
  type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";

import type { Filter, FilterFieldConfig } from "@/components/reui/filters";
import type { AppLocale } from "@/i18n/config";

export type AdminInvoiceGridItem = {
  id: string;
  number: string | null;
  clientName: string;
  workspaceId: string;
  workspaceName: string;
  issuerId: string;
  issuerName: string;
  total: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  displayStatus: InvoiceDisplayStatus;
};

export function AdminInvoicesGrid({
  items,
}: {
  items: AdminInvoiceGridItem[];
}) {
  const t = useTranslations("Admin.invoices");
  const tTable = useTranslations("Admin.table");
  const locale = useLocale() as AppLocale;

  const workspaceOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of items) {
      map.set(row.workspaceId, row.workspaceName);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [items, locale]);

  const issuerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of items) {
      map.set(row.issuerId, row.issuerName);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [items, locale]);

  const filterFields = useMemo<FilterFieldConfig<string>[]>(
    () => [
      {
        key: "q",
        label: tTable("search"),
        type: "text",
        icon: <SearchIcon className="size-3.5" />,
        placeholder: t("filters.searchPlaceholder"),
        defaultOperator: "contains",
      },
      {
        key: "status",
        label: t("columns.status"),
        type: "select",
        defaultOperator: "is",
        options: INVOICE_DISPLAY_STATUSES.map((s) => ({
          value: s,
          label: DISPLAY_STATUS_LABELS[s],
        })),
      },
      {
        key: "workspaceId",
        label: t("columns.workspace"),
        type: "select",
        icon: <WarehouseIcon className="size-3.5" />,
        defaultOperator: "is",
        searchable: true,
        options: workspaceOptions,
      },
      {
        key: "issuerId",
        label: t("columns.issuer"),
        type: "select",
        icon: <Building2Icon className="size-3.5" />,
        defaultOperator: "is",
        searchable: true,
        options: issuerOptions,
      },
    ],
    [issuerOptions, t, tTable, workspaceOptions],
  );

  const [filters, setFilters] = useState<Filter<string>[]>(() =>
    filtersFromRecord({}, filterFields),
  );
  const [sorting, setSorting] = useState<SortingState>([
    { id: "issueDate", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({
      id: false,
      issuerId: false,
      workspaceId: false,
    });
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("");
  const [issuerFilter, setIssuerFilter] = useState("");

  const handleFiltersChange = (next: Filter<string>[]) => {
    setFilters(next);
    const rec = recordFromFilters(next);
    setGlobalFilter(rec.q ?? "");
    setStatusFilter(rec.status ?? "");
    setWorkspaceFilter(rec.workspaceId ?? "");
    setIssuerFilter(rec.issuerId ?? "");
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const columns = useMemo<ColumnDef<DataGridFeatures, AdminInvoiceGridItem>[]>(
    () => [
      {
        id: "number",
        accessorFn: (row) => row.number ?? "",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.number")} />
        ),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {row.original.number ?? "—"}
          </span>
        ),
        meta: { headerTitle: t("columns.number") },
      },
      {
        accessorKey: "clientName",
        id: "clientName",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.client")} />
        ),
        meta: { headerTitle: t("columns.client"), autoSize: true },
      },
      {
        accessorKey: "workspaceName",
        id: "workspaceName",
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={t("columns.workspace")}
          />
        ),
        meta: { headerTitle: t("columns.workspace"), autoSize: true },
      },
      {
        accessorKey: "issuerName",
        id: "issuerName",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.issuer")} />
        ),
        meta: { headerTitle: t("columns.issuer"), autoSize: true },
      },
      {
        id: "total",
        accessorFn: (row) => Number(row.total) || 0,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.total")} />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatMoney(
              Number(row.original.total) || 0,
              row.original.currency,
              locale,
            )}
          </span>
        ),
        meta: { headerTitle: t("columns.total") },
      },
      {
        accessorKey: "issueDate",
        id: "issueDate",
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={t("columns.issueDate")}
          />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatInvoiceDate(row.original.issueDate, locale)}
          </span>
        ),
        meta: { headerTitle: t("columns.issueDate") },
      },
      {
        accessorKey: "dueDate",
        id: "dueDate",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.dueDate")} />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatInvoiceDate(row.original.dueDate, locale)}
          </span>
        ),
        meta: { headerTitle: t("columns.dueDate") },
      },
      {
        accessorKey: "displayStatus",
        id: "displayStatus",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.status")} />
        ),
        cell: ({ row }) => (
          <InvoiceStatusBadge status={row.original.displayStatus} />
        ),
        meta: { headerTitle: t("columns.status") },
      },
      {
        id: "id",
        accessorFn: (row) => row.id,
        enableSorting: false,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.id")} />
        ),
        cell: ({ row }) => <AdminCopyId value={row.original.id} />,
        meta: { headerTitle: t("columns.id") },
      },
      {
        id: "workspaceId",
        accessorFn: (row) => row.workspaceId,
        enableSorting: false,
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={t("columns.workspaceId")}
          />
        ),
        cell: ({ row }) => <AdminCopyId value={row.original.workspaceId} />,
        meta: { headerTitle: t("columns.workspaceId") },
      },
      {
        id: "issuerId",
        accessorFn: (row) => row.issuerId,
        enableSorting: false,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.issuerId")} />
        ),
        cell: ({ row }) => <AdminCopyId value={row.original.issuerId} />,
        meta: { headerTitle: t("columns.issuerId") },
      },
    ],
    [locale, t],
  );

  const table = useTable({
    features: dataGridFeatures,
    data: items,
    columns,
    state: {
      sorting,
      pagination,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      if (statusFilter && row.original.displayStatus !== statusFilter) {
        return false;
      }
      if (workspaceFilter && row.original.workspaceId !== workspaceFilter) {
        return false;
      }
      if (issuerFilter && row.original.issuerId !== issuerFilter) {
        return false;
      }
      const q = String(filterValue ?? "")
        .trim()
        .toLowerCase();
      if (!q) return true;
      return (
        (row.original.number ?? "").toLowerCase().includes(q) ||
        row.original.clientName.toLowerCase().includes(q) ||
        row.original.workspaceName.toLowerCase().includes(q) ||
        row.original.issuerName.toLowerCase().includes(q) ||
        row.original.id.toLowerCase().includes(q)
      );
    },
  });

  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <AppDataGrid
      columnsLabel={tTable("columns")}
      emptyMessage={t("empty")}
      paginationLabels={{
        info: tTable("paginationInfo"),
        nextPageLabel: tTable("nextPage"),
        previousPageLabel: tTable("previousPage"),
        rowsPerPageLabel: tTable("rowsPerPage"),
      }}
      recordCount={filteredCount}
      table={table}
      toolbar={
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <AppFilters
            fields={filterFields}
            filters={filters}
            onChange={handleFiltersChange}
          />
          <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {t("count", { count: filteredCount })}
          </p>
        </div>
      }
    />
  );
}
