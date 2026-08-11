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
 * column visibility, scroll area, Czech pagination labels by default.
 */
export function AppDataGrid<TData extends object>({
  table,
  recordCount,
  toolbar,
  emptyMessage = "Žádné záznamy.",
  className,
  showColumnVisibility = true,
  showPagination = true,
  columnsLabel = "Sloupce",
  paginationLabels,
}: AppDataGridProps<TData>) {
  return (
    <DataGrid
      emptyMessage={emptyMessage}
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
                    {columnsLabel}
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
            info={paginationLabels?.info ?? "{from} – {to} z {count}"}
            nextPageLabel={paginationLabels?.nextPageLabel ?? "Další stránka"}
            previousPageLabel={
              paginationLabels?.previousPageLabel ?? "Předchozí stránka"
            }
            rowsPerPageLabel={
              paginationLabels?.rowsPerPageLabel ?? "Řádků na stránku"
            }
            sizes={[25, 50, 100]}
          />
        ) : null}
      </div>
    </DataGrid>
  );
}
