"use client";

import { deleteClient } from "@/actions/clients";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ClientSnapshot } from "@invoicey/invoice-core/schema";
import {
  useTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

export type ClientTableItem = {
  rowId: string;
  source: string;
  snapshot: ClientSnapshot;
  /** Comes from the plan catalog: no edit, no delete (ADR 0036). */
  managed: boolean;
};

export function ClientsDataGrid({ items }: { items: ClientTableItem[] }) {
  const t = useTranslations("Clients");
  const tTable = useTranslations("Clients.table");
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

  const columns = useMemo<ColumnDef<DataGridFeatures, ClientTableItem>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.snapshot.name,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tTable("name")} />
        ),
        meta: { headerTitle: tTable("name"), autoSize: true },
      },
      {
        id: "ico",
        accessorFn: (row) => row.snapshot.ico ?? "",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tTable("ico")} />
        ),
        cell: ({ row }) => row.original.snapshot.ico ?? tCommon("emptyDash"),
        meta: { headerTitle: tTable("ico") },
      },
      {
        id: "city",
        accessorFn: (row) => row.snapshot.address.city,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tTable("city")} />
        ),
        meta: { headerTitle: tTable("city") },
      },
      {
        accessorKey: "source",
        id: "source",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tTable("source")} />
        ),
        cell: ({ row }) => (
          <span>
            {row.original.source === "ares"
              ? tTable("sourceAres")
              : tTable("sourceManual")}
          </span>
        ),
        meta: { headerTitle: tTable("source") },
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">{tTable("actions")}</span>,
        cell: ({ row }) =>
          // A managed client is owned by the plan, so there is no edit or
          // delete to offer. The badge says where it came from; the server
          // actions refuse either way (ADR 0036).
          row.original.managed ? (
            <div className="flex justify-end">
              <Badge variant="secondary">{t("managedBadge")}</Badge>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button
                render={
                  <Link href={`/clients/${row.original.rowId}/edit`} prefetch />
                }
                size="sm"
                variant="outline"
              >
                {tTable("edit")}
              </Button>
              <form action={deleteClient}>
                <input name="id" type="hidden" value={row.original.rowId} />
                <SubmitButton
                  pendingLabel={tTable("deleting")}
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
        (s.ico ?? "").toLowerCase().includes(q) ||
        s.address.city.toLowerCase().includes(q) ||
        row.original.source.toLowerCase().includes(q)
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
