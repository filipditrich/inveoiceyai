"use client";

import { useMemo, useState } from "react";
import { deleteIssuer, setDefaultIssuer } from "@/actions/issuers";
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
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  useTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import type { IssuerSnapshot } from "@invoicey/invoice-core/schema";

import type { Filter, FilterFieldConfig } from "@/components/reui/filters";

export type IssuerTableItem = {
  rowId: string;
  source: string;
  snapshot: IssuerSnapshot;
  isDefault: boolean;
};

export function IssuersDataGrid({ items }: { items: IssuerTableItem[] }) {
  const t = useTranslations("Issuers");
  const tTable = useTranslations("Issuers.table");
  const tCommon = useTranslations("Common");
  const filterFields = useMemo<FilterFieldConfig<string>[]>(
    () => [
      {
        key: "q",
        label: tCommon("search"),
        type: "text",
        icon: <SearchIcon className="size-3.5" />,
        placeholder: tTable("searchPlaceholder"),
        defaultOperator: "contains",
      },
    ],
    [tCommon, tTable],
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
    useState<ColumnVisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const handleFiltersChange = (next: Filter<string>[]) => {
    setFilters(next);
    const rec = recordFromFilters(next);
    setGlobalFilter(rec.q ?? "");
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const columns = useMemo<ColumnDef<DataGridFeatures, IssuerTableItem>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.snapshot.name,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tTable("name")} />
        ),
        cell: ({ row }) => (
          <span className="flex flex-wrap items-center gap-2">
            <span>{row.original.snapshot.name}</span>
            {row.original.isDefault ? (
              <Badge variant="secondary">{tTable("defaultBadge")}</Badge>
            ) : null}
          </span>
        ),
        meta: { headerTitle: tTable("name"), autoSize: true },
      },
      {
        id: "ico",
        accessorFn: (row) => row.snapshot.ico,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tTable("ico")} />
        ),
        meta: { headerTitle: tTable("ico") },
      },
      {
        id: "dic",
        accessorFn: (row) => row.snapshot.dic ?? "",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tTable("dic")} />
        ),
        cell: ({ row }) => row.original.snapshot.dic ?? tCommon("emptyDash"),
        meta: { headerTitle: tTable("dic") },
      },
      {
        id: "vatPayer",
        accessorFn: (row) =>
          row.snapshot.vatPayer ? tTable("vatPayer") : tTable("vatNonPayer"),
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tTable("vat")} />
        ),
        meta: { headerTitle: tTable("vat") },
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">{tTable("actions")}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            {row.original.isDefault ? null : (
              <form action={setDefaultIssuer}>
                <input name="id" type="hidden" value={row.original.rowId} />
                <SubmitButton
                  pendingLabel={tTable("setDefault")}
                  size="sm"
                  variant="outline"
                >
                  {tTable("setDefault")}
                </SubmitButton>
              </form>
            )}
            <Button
              render={
                <Link
                  href={`/issuers/${row.original.rowId}/edit/identity`}
                  prefetch
                />
              }
              size="sm"
              variant="outline"
            >
              {tTable("edit")}
            </Button>
            <form action={deleteIssuer}>
              <input name="id" type="hidden" value={row.original.rowId} />
              <SubmitButton
                pendingLabel={t("deleting")}
                size="sm"
                variant="destructive"
              >
                {tTable("delete")}
              </SubmitButton>
            </form>
          </div>
        ),
        meta: { headerTitle: tTable("actions") },
      },
    ],
    [t, tCommon, tTable],
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
    getRowId: (row) => row.rowId,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue ?? "")
        .trim()
        .toLowerCase();
      if (!q) {
        return true;
      }
      const s = row.original.snapshot;
      return (
        s.name.toLowerCase().includes(q) ||
        s.ico.toLowerCase().includes(q) ||
        (s.dic ?? "").toLowerCase().includes(q)
      );
    },
  });

  return (
    <AppDataGrid
      emptyMessage={t("empty")}
      recordCount={table.getFilteredRowModel().rows.length}
      table={table}
      toolbar={
        <AppFilters
          fields={filterFields}
          filters={filters}
          onChange={handleFiltersChange}
        />
      }
    />
  );
}
