"use client";

import { useMemo, useState } from "react";
import { AdminCopyId } from "@/components/admin/admin-copy-id";
import { AppDataGrid } from "@/components/data-grid/app-data-grid";
import {
  AppFilters,
  filtersFromRecord,
  recordFromFilters,
} from "@/components/data-grid/app-filters";
import {
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import {
  useTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { SearchIcon, WarehouseIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { Filter, FilterFieldConfig } from "@/components/reui/filters";
import type { AppLocale } from "@/i18n/config";

export type AdminIssuerGridItem = {
  id: string;
  name: string;
  ico: string | null;
  dic: string | null;
  workspaceId: string;
  workspaceName: string;
  source: string;
  updatedAtIso: string;
};

export function AdminIssuersGrid({ items }: { items: AdminIssuerGridItem[] }) {
  const t = useTranslations("Admin.issuers");
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
        key: "workspaceId",
        label: t("columns.workspace"),
        type: "select",
        icon: <WarehouseIcon className="size-3.5" />,
        defaultOperator: "is",
        searchable: true,
        options: workspaceOptions,
      },
      {
        key: "source",
        label: t("columns.source"),
        type: "select",
        defaultOperator: "is",
        options: [
          { value: "ares", label: t("source.ares") },
          { value: "manual", label: t("source.manual") },
        ],
      },
    ],
    [t, tTable, workspaceOptions],
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
    useState<ColumnVisibilityState>({
      id: false,
      workspaceId: false,
    });
  const [globalFilter, setGlobalFilter] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  const handleFiltersChange = (next: Filter<string>[]) => {
    setFilters(next);
    const rec = recordFromFilters(next);
    setGlobalFilter(rec.q ?? "");
    setWorkspaceFilter(rec.workspaceId ?? "");
    setSourceFilter(rec.source ?? "");
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const columns = useMemo<ColumnDef<DataGridFeatures, AdminIssuerGridItem>[]>(
    () => [
      {
        accessorKey: "name",
        id: "name",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.name")} />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
        meta: { headerTitle: t("columns.name"), autoSize: true },
      },
      {
        id: "ico",
        accessorFn: (row) => row.ico ?? "",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.ico")} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.ico ?? "—"}
          </span>
        ),
        meta: { headerTitle: t("columns.ico") },
      },
      {
        id: "dic",
        accessorFn: (row) => row.dic ?? "",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.dic")} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.dic ?? "—"}</span>
        ),
        meta: { headerTitle: t("columns.dic") },
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
        accessorKey: "source",
        id: "source",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.source")} />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary">
            {row.original.source === "ares"
              ? t("source.ares")
              : t("source.manual")}
          </Badge>
        ),
        meta: { headerTitle: t("columns.source") },
      },
      {
        id: "updatedAt",
        accessorFn: (row) => row.updatedAtIso,
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={t("columns.updatedAt")}
          />
        ),
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
            {formatDateTime(row.original.updatedAtIso, locale)}
          </span>
        ),
        meta: { headerTitle: t("columns.updatedAt") },
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
      if (workspaceFilter && row.original.workspaceId !== workspaceFilter) {
        return false;
      }
      if (sourceFilter && row.original.source !== sourceFilter) {
        return false;
      }
      const q = String(filterValue ?? "")
        .trim()
        .toLowerCase();
      if (!q) return true;
      return (
        row.original.name.toLowerCase().includes(q) ||
        (row.original.ico?.toLowerCase().includes(q) ?? false) ||
        (row.original.dic?.toLowerCase().includes(q) ?? false) ||
        row.original.workspaceName.toLowerCase().includes(q) ||
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
