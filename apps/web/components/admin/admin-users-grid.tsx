"use client";

import Link from "next/link";

import { setPlatformRoleAction } from "@/actions/admin";
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
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import type { AppLocale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format";
import type { PlatformRole } from "@invoicey/db";
import {
  useTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { SearchIcon, ShieldIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

export type AdminUserGridItem = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  platformRole: PlatformRole;
  defaultWorkspaceId: string | null;
  referralCode: string | null;
  referredByEmail: string | null;
  membershipCount: number;
  createdAtIso: string;
};

export function AdminUsersGrid({
  items,
  currentUserId,
}: {
  items: AdminUserGridItem[];
  currentUserId: string;
}) {
  const t = useTranslations("Admin.users");
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
      {
        key: "role",
        label: t("columns.role"),
        type: "select",
        icon: <ShieldIcon className="size-3.5" />,
        defaultOperator: "is",
        options: [
          { value: "admin", label: t("role.admin") },
          { value: "none", label: t("role.none") },
        ],
      },
    ],
    [t, tTable],
  );

  const [filters, setFilters] = useState<Filter<string>[]>(() =>
    filtersFromRecord({}, filterFields),
  );
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({
      id: false,
      defaultWorkspaceId: false,
      referralCode: false,
      referredByEmail: true,
    });
  const [globalFilter, setGlobalFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const handleFiltersChange = (next: Filter<string>[]) => {
    setFilters(next);
    const rec = recordFromFilters(next);
    setGlobalFilter(rec.q ?? "");
    setRoleFilter(rec.role ?? "");
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const columns = useMemo<ColumnDef<DataGridFeatures, AdminUserGridItem>[]>(
    () => [
      {
        accessorKey: "name",
        id: "name",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.name")} />
        ),
        cell: ({ row }) => (
          <Link
            className="block min-w-0 hover:underline"
            href={`/admin/users/${row.original.id}`}
          >
            <div className="truncate font-medium">{row.original.name}</div>
            <div className="text-muted-foreground truncate text-xs">
              {row.original.email}
            </div>
          </Link>
        ),
        meta: { headerTitle: t("columns.name"), autoSize: true },
      },
      {
        accessorKey: "email",
        id: "email",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.email")} />
        ),
        meta: { headerTitle: t("columns.email"), autoSize: true },
      },
      {
        accessorKey: "emailVerified",
        id: "emailVerified",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.verified")} />
        ),
        cell: ({ row }) =>
          row.original.emailVerified ? (
            <Badge variant="secondary">{t("verified.yes")}</Badge>
          ) : (
            <Badge variant="outline">{t("verified.no")}</Badge>
          ),
        meta: { headerTitle: t("columns.verified") },
      },
      {
        accessorKey: "platformRole",
        id: "platformRole",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("columns.role")} />
        ),
        cell: ({ row }) =>
          row.original.platformRole === "admin" ? (
            <Badge variant="default">{t("role.admin")}</Badge>
          ) : (
            <Badge variant="secondary">{t("role.none")}</Badge>
          ),
        meta: { headerTitle: t("columns.role") },
      },
      {
        accessorKey: "membershipCount",
        id: "membershipCount",
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={t("columns.memberships")}
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.membershipCount}</span>
        ),
        meta: { headerTitle: t("columns.memberships") },
      },
      {
        id: "referralCode",
        accessorFn: (row) => row.referralCode ?? "",
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={t("columns.referralCode")}
          />
        ),
        cell: ({ row }) =>
          row.original.referralCode ? (
            <span className="font-mono text-xs">
              {row.original.referralCode}
            </span>
          ) : (
            "—"
          ),
        meta: { headerTitle: t("columns.referralCode") },
      },
      {
        id: "referredByEmail",
        accessorFn: (row) => row.referredByEmail ?? "",
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={t("columns.referredBy")}
          />
        ),
        cell: ({ row }) =>
          row.original.referredByEmail ? (
            <span className="truncate text-xs">
              {row.original.referredByEmail}
            </span>
          ) : (
            "—"
          ),
        meta: { headerTitle: t("columns.referredBy"), autoSize: true },
      },
      {
        id: "defaultWorkspaceId",
        accessorFn: (row) => row.defaultWorkspaceId ?? "",
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={t("columns.defaultWorkspace")}
          />
        ),
        cell: ({ row }) =>
          row.original.defaultWorkspaceId ? (
            <AdminCopyId value={row.original.defaultWorkspaceId} />
          ) : (
            "—"
          ),
        meta: { headerTitle: t("columns.defaultWorkspace") },
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
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">{t("columns.actions")}</span>,
        cell: ({ row }) => {
          const isAdmin = row.original.platformRole === "admin";
          const isSelf = row.original.id === currentUserId;
          return (
            <div className="flex justify-end">
              <form action={setPlatformRoleAction}>
                <input name="userId" type="hidden" value={row.original.id} />
                <input
                  name="role"
                  type="hidden"
                  value={isAdmin ? "none" : "admin"}
                />
                <SubmitButton
                  disabled={isSelf && isAdmin}
                  size="sm"
                  variant="outline"
                >
                  {isAdmin ? t("actions.revoke") : t("actions.grant")}
                </SubmitButton>
              </form>
            </div>
          );
        },
        meta: { headerTitle: t("columns.actions") },
      },
    ],
    [currentUserId, locale, t],
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
      const roleOk = !roleFilter || row.original.platformRole === roleFilter;
      if (!roleOk) return false;
      if (!q) return true;
      return (
        row.original.name.toLowerCase().includes(q) ||
        row.original.email.toLowerCase().includes(q) ||
        row.original.id.toLowerCase().includes(q) ||
        (row.original.referralCode?.toLowerCase().includes(q) ?? false) ||
        (row.original.referredByEmail?.toLowerCase().includes(q) ?? false)
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
