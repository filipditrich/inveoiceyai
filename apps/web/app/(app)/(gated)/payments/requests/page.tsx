import { PageHeader } from "@/components/layout/page-header";
import { SectionPager } from "@/components/layout/section-pager";
import { TableFilterBar } from "@/components/layout/table-filter-bar";
import { TablePager } from "@/components/payments/table-pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isAppLocale } from "@/i18n/config";
import { requireWorkspace } from "@/lib/auth/session";
import { assertCan, can } from "@/lib/authz/can";
import { formatInvoiceDate, formatMoney } from "@/lib/format";
import {
  pageSlice,
  parsePage,
  parseRequestStatus,
  paymentsSearchHref,
} from "@/lib/payments/page-query";
import { QrCodeIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { countPaymentRequests, listPaymentRequests } from "@invoicey/db";
import { db } from "@invoicey/db/client";

import type { AppLocale } from "@/i18n/config";

function statusVariant(status: string): "default" | "outline" | "secondary" {
  if (status === "settled") return "default";
  if (status === "cancelled") return "secondary";
  return "outline";
}

function requestStatusKey(
  status: string,
): "open" | "settled" | "cancelled" | null {
  if (status === "open" || status === "settled" || status === "cancelled") {
    return status;
  }
  return null;
}

export default async function PaymentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  await assertCan("payments:read");
  const { workspaceId } = await requireWorkspace();
  const [canManagePayments, t, tNav, localeValue, tStatus, tOpen, sp] =
    await Promise.all([
      can("payments:manage"),
      getTranslations("PaymentRequests.list"),
      getTranslations("App.nav"),
      getLocale(),
      getTranslations("Payments.requestStatus"),
      getTranslations("Payments"),
      searchParams,
    ]);
  const locale: AppLocale = isAppLocale(localeValue) ? localeValue : "cs";
  const status = parseRequestStatus(sp.status);
  const statusFilter = status === "all" ? undefined : status;
  const total = await countPaymentRequests(db, workspaceId, statusFilter);
  const slice = pageSlice(total, parsePage(sp.page));
  const requests = await listPaymentRequests(db, workspaceId, {
    limit: slice.limit,
    offset: slice.offset,
    status: statusFilter,
  });
  const columns = await getTranslations("Payments.columns");
  const query = { status: status === "all" ? undefined : status };

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          canManagePayments ? (
            <Button render={<Link href="/payments/requests/new" />}>
              <QrCodeIcon data-icon="inline-start" />
              {t("create")}
            </Button>
          ) : null
        }
        description={t("description")}
        eyebrow={tNav("payments")}
        icon={<QrCodeIcon />}
        title={t("title")}
      />

      <Card className="overflow-hidden bg-card">
        <div className="pt-4">
          <TableFilterBar
            hrefFor={(next) =>
              paymentsSearchHref("/payments/requests", query, {
                status: next === "all" ? "" : next,
                page: "1",
              })
            }
            options={[
              { value: "all", label: t("filterAll") },
              { value: "open", label: tStatus("open") },
              { value: "settled", label: tStatus("settled") },
              { value: "cancelled", label: tStatus("cancelled") },
            ]}
            value={status}
          />
        </div>
        <CardContent className="px-0 pt-0">
          {requests.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{columns("note")}</TableHead>
                    <TableHead>{columns("vs")}</TableHead>
                    <TableHead>{columns("status")}</TableHead>
                    <TableHead className="text-right">
                      {columns("amount")}
                    </TableHead>
                    <TableHead className="text-right">
                      {columns("received")}
                    </TableHead>
                    <TableHead>{columns("date")}</TableHead>
                    <TableHead className="text-right">
                      {columns("actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const statusKey = requestStatusKey(request.status);
                    return (
                      <TableRow key={request.id}>
                        <TableCell className="max-w-56 truncate font-medium">
                          <Link
                            href={`/payments/requests/${request.id}`}
                            className="hover:underline"
                          >
                            {request.message?.trim() || t("untitled")}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {request.variableSymbol}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(request.status)}>
                            {statusKey ? tStatus(statusKey) : request.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(
                            Number(request.amount),
                            request.currency,
                            locale,
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {formatMoney(
                            Number(request.allocatedAmount),
                            request.currency,
                            locale,
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatInvoiceDate(
                            request.createdAt.toISOString().slice(0, 10),
                            locale,
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            render={
                              <Link href={`/payments/requests/${request.id}`} />
                            }
                            size="sm"
                            variant="outline"
                          >
                            {tOpen("openRequest")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePager
                count={slice.to === 0 ? 0 : total}
                from={slice.from}
                nextHref={
                  slice.page < slice.pageCount
                    ? paymentsSearchHref("/payments/requests", query, {
                        page: String(slice.page + 1),
                      })
                    : null
                }
                page={slice.page}
                pageCount={slice.pageCount}
                previousHref={
                  slice.page > 1
                    ? paymentsSearchHref("/payments/requests", query, {
                        page: String(slice.page - 1),
                      })
                    : null
                }
                to={slice.to}
              />
            </>
          )}
        </CardContent>
      </Card>
      <SectionPager group="payments" />
    </div>
  );
}
