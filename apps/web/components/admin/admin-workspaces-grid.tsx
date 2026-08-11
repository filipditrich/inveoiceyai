"use client";

import { AdminCopyId } from "@/components/admin/admin-copy-id";
import { AppDataGrid } from "@/components/data-grid/app-data-grid";
import {
  AppFilters,
  filtersFromRecord,
  recordFromFilters,
} from "@/components/data-grid/app-filters";
import type { Filter, FilterFieldConfig } from "@/components/reui/filters";
import {
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import type { AppLocale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format";
import {
  useTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { SearchIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

export type AdminWorkspaceGridItem = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  invoiceCount: number;
  issuerCount: number;
  createdAtIso: string;
};

export function AdminWorkspacesGrid({
  items,
}: {
  items: AdminWorkspaceGridItem[];
}) {
  const t = useTranslations("Admin.workspaces");
  const tTable = useTranslations("Admin.table");
  const locale = useLocale() as AppLocale;

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
    ],
    [t, tTable],
  );

  const [filters, setFilters] = useState<Filter<string>[]>(() =>
    filtersFromRecord({}, filterFields),
  );
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({ id: false });
  const [globalFilter, setGlobalFilter] = useState("");

  const handleFiltersChange = (next: Filter<string>[]) => {
    setFilters(next);
    const rec = recordFromFilters(next);
    setGlobalFilter(rec.q ?? "");
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const columns = useMemo<
    ColumnDef<DataGridFeatures, AdminWorkspaceGridItem>[]
  >(
    () => [
      {
        accessorKey: "name",
        id: "name",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.name")} />
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{row.original.name}</div>
            <div className="text-muted-foreground truncate font-mono text-xs">
              {row.original.slug}
            </div>
          </div>
        ),
        meta: { headerTitle: t("columns.name"), autoSize: true },
      },
      {
        accessorKey: "slug",
        id: "slug",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.slug")} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.slug}</span>
        ),
        meta: { headerTitle: t("columns.slug") },
      },
      {
        accessorKey: "memberCount",
        id: "memberCount",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.members")} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.memberCount}</span>
        ),
        meta: { headerTitle: t("columns.members") },
      },
      {
        accessorKey: "invoiceCount",
        id: "invoiceCount",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.invoices")} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.invoiceCount}</span>
        ),
        meta: { headerTitle: t("columns.invoices") },
      },
      {
        accessorKey: "issuerCount",
        id: "issuerCount",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.issuers")} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.issuerCount}</span>
        ),
        meta: { headerTitle: t("columns.issuers") },
      },
      {
        id: "createdAt",
        accessorFn: (row) => row.createdAtIso,
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={t("columns.createdAt")}
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap text-xs tabular-nums">
            {formatDateTime(row.original.createdAtIso, locale)}
          </span>
        ),
        meta: { headerTitle: t("columns.createdAt") },
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
      const q = String(filterValue ?? "")
        .trim()
        .toLowerCase();
      if (!q) return true;
      return (
        row.original.name.toLowerCase().includes(q) ||
        row.original.slug.toLowerCase().includes(q) ||
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
          <p className="text-muted-foreground shrink-0 text-sm tabular-nums">
            {t("count", { count: filteredCount })}
          </p>
        </div>
      }
    />
  );
}
