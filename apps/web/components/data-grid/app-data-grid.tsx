"use client";

import {
  DataGrid,
  DataGridContainer,
} from "@/components/reui/data-grid/data-grid";
import type { DataGridTableInstance } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/components/reui/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Columns3Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

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
      <div className={cn("min-w-0 max-w-full space-y-3", className)}>
        {toolbar || showColumnVisibility ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">{toolbar}</div>
            {showColumnVisibility ? (
              <DataGridColumnVisibility
                table={table}
                trigger={
                  <Button size="sm" variant="outline">
                    <Columns3Icon className="size-4" />
                    {columnsLabel ?? t("columns")}
                  </Button>
                }
              />
            ) : null}
          </div>
        ) : null}

        <DataGridContainer className="min-w-0 max-w-full overflow-hidden rounded-md border">
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
