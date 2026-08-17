import type { RecentInvoice } from "@/lib/dashboard-metrics";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AppLocale } from "@/i18n/config";
import { formatInvoiceDate, formatMoney } from "@/lib/format";
import { DISPLAY_STATUS_ROW_ACCENT } from "@/lib/invoice-status-ui";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

export async function DashboardRecentInvoices({
  rows,
}: {
  rows: RecentInvoice[];
}) {
  const t = await getTranslations("Dashboard.recent");
  const locale = (await getLocale()) as AppLocale;

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("empty")}{" "}
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href="/invoices/new"
        >
          {t("createFirst")}
        </Link>
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <Link
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          href="/invoices"
        >
          {t("viewAll")}
        </Link>
      </div>

      {/* Six columns cannot fit a phone; the table would scroll sideways and
          clip the invoice number. Stack the same fields instead. */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li
            className={cn(
              "rounded-md border p-3",
              DISPLAY_STATUS_ROW_ACCENT[row.displayStatus],
            )}
            key={row.id}
          >
            <Link className="block" href={`/invoices/${row.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium tabular-nums">
                    {row.number ?? t("draft")}
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    {row.clientName}
                  </p>
                </div>
                <InvoiceStatusBadge status={row.displayStatus} />
              </div>
              <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums">
                <span className="text-foreground font-medium">
                  {formatMoney(
                    Number(row.total) || 0,
                    row.currency || "CZK",
                    locale,
                  )}
                </span>
                <span>
                  {t("due")} {formatInvoiceDate(row.dueDate, locale)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("number")}</TableHead>
              <TableHead>{t("client")}</TableHead>
              <TableHead>{t("issued")}</TableHead>
              <TableHead>{t("due")}</TableHead>
              <TableHead>{t("total")}</TableHead>
              <TableHead>{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                className={cn(DISPLAY_STATUS_ROW_ACCENT[row.displayStatus])}
                key={row.id}
              >
                <TableCell className="font-medium tabular-nums">
                  <Link
                    className="underline-offset-4 hover:underline"
                    href={`/invoices/${row.id}`}
                  >
                    {row.number ?? t("draft")}
                  </Link>
                </TableCell>
                <TableCell>{row.clientName}</TableCell>
                <TableCell className="tabular-nums">
                  {formatInvoiceDate(row.issueDate, locale)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatInvoiceDate(row.dueDate, locale)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatMoney(
                    Number(row.total) || 0,
                    row.currency || "CZK",
                    locale,
                  )}
                </TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={row.displayStatus} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
