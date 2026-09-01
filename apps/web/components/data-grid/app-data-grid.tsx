"use client";

import type { ReactNode } from "react";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/reui/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/components/reui/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { flexRender } from "@tanstack/react-table";
import { Columns3Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { DataGridTableInstance } from "@/components/reui/data-grid/data-grid";

type AppDataGridProps<TData extends object> = {
  table: DataGridTableInstance<TData>;
  recordCount: number;
  toolbar?: ReactNode;
  emptyMessage?: ReactNode;
  className?: string;
  showColumnVisibility?: boolean;
  showPagination?: boolean;
  columnsLabel?: string;
  paginationLabels?: {
    info?: string;
    nextPageLabel?: string;
    previousPageLabel?: string;
    rowsPerPageLabel?: string;
  };
};

/**
 * Phone rendering of the same rows. A fixed-width multi-column table only
 * scrolls sideways at 390px and clips its first column, so each row becomes a
 * card: the leading column is the heading, the rest are labelled fields.
 */
function DataGridMobileCards<TData extends object>({
  table,
  emptyMessage,
}: {
  table: DataGridTableInstance<TData>;
  emptyMessage: ReactNode;
}) {
  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return (
      <p className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground md:hidden">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="space-y-2 md:hidden">
      {rows.map((row) => {
        const cells = row
          .getVisibleCells()
          .filter((cell) => cell.column.id !== "select");
        const [lead, ...rest] = cells;
        return (
          <li className="space-y-2 rounded-md border bg-card p-3" key={row.id}>
            {lead ? (
              <div className="min-w-0 font-medium">
                {flexRender(lead.column.columnDef.cell, lead.getContext())}
              </div>
            ) : null}
            <dl className="grid gap-x-3 gap-y-1.5 text-sm">
              {rest.map((cell) => {
                const label = cell.column.columnDef.meta?.headerTitle;
                const isActions = cell.column.id === "actions";
                return (
                  <div
                    className={cn(
                      "flex items-center justify-between gap-3",
                      isActions && "pt-1",
                    )}
                    key={cell.id}
                  >
                    {label && !isActions ? (
                      <dt className="shrink-0 text-muted-foreground">
                        {label}
                      </dt>
                    ) : null}
                    <dd
                      className={cn(
                        "min-w-0 truncate text-right",
                        isActions && "ml-auto",
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Shared ReUI Data Grid shell: sticky dense header, optional toolbar,
 * column visibility, scroll area, locale-aware chrome.
 */
export function AppDataGrid<TData extends object>({
  table,
  recordCount,
  toolbar,
  emptyMessage,
  className,
  showColumnVisibility = true,
  showPagination = true,
  columnsLabel,
  paginationLabels,
}: AppDataGridProps<TData>) {
  const t = useTranslations("DataGrid");
  return (
    <DataGrid
      emptyMessage={emptyMessage ?? t("empty")}
      recordCount={recordCount}
      table={table}
      tableLayout={{
        dense: true,
        headerSticky: true,
        rowBorder: true,
        headerBackground: true,
        columnsVisibility: showColumnVisibility,
        width: "fixed",
      }}
    >
      <div className={cn("max-w-full min-w-0 space-y-3", className)}>
        {toolbar || showColumnVisibility ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">{toolbar}</div>
            {showColumnVisibility ? (
              <DataGridColumnVisibility
                table={table}
                trigger={
                  /* Column visibility only affects the md+ table. */
                  <Button
                    className="hidden md:inline-flex"
                    size="sm"
                    variant="outline"
                  >
                    <Columns3Icon className="size-4" />
                    {columnsLabel ?? t("columns")}
                  </Button>
                }
              />
            ) : null}
          </div>
        ) : null}

        <DataGridMobileCards
          emptyMessage={emptyMessage ?? t("empty")}
          table={table}
        />

        <DataGridContainer className="hidden max-w-full min-w-0 overflow-hidden rounded-md border md:block">
          <DataGridScrollArea className="max-h-[min(70vh,720px)] max-w-full overflow-x-auto">
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>

        {showPagination ? (
          <DataGridPagination
            info={paginationLabels?.info ?? t.raw("info")}
            nextPageLabel={paginationLabels?.nextPageLabel ?? t("nextPage")}
            previousPageLabel={
              paginationLabels?.previousPageLabel ?? t("previousPage")
            }
            rowsPerPageLabel={
              paginationLabels?.rowsPerPageLabel ?? t("rowsPerPage")
            }
            sizes={[25, 50, 100]}
          />
        ) : null}
      </div>
    </DataGrid>
  );
}
