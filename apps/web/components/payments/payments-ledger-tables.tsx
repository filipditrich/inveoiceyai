import { reversePayment } from "@/actions/payments";
import { TableFilterBar } from "@/components/layout/table-filter-bar";
import { TablePager } from "@/components/payments/table-pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInvoiceDate, formatMoney } from "@/lib/format";
import {
  paymentsSearchHref,
  type IncomingStateFilter,
} from "@/lib/payments/page-query";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type { AppLocale } from "@/i18n/config";

export type IncomingTransactionRow = {
  id: string;
  bookedDate: string;
  amount: string;
  currency: string;
  variableSymbol: string | null;
  counterpartyName: string | null;
  message: string | null;
  allocated: boolean;
};

export type AllocationHistoryRow = {
  id: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  clientName: string | null;
  paymentRequestId: string | null;
  paymentRequestMessage: string | null;
  amount: string;
  currency: string;
  effectiveDate: string;
  sourceLabel: string;
  reversedAt: Date | null;
};

type PagerQuery = {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  count: number;
  query: Record<string, string | undefined>;
  pageKey: "incoming" | "history";
};

export async function PaymentsIncomingTable({
  transactions,
  locale,
  pager,
  incomingState,
}: {
  transactions: IncomingTransactionRow[];
  locale: AppLocale;
  pager: PagerQuery;
  incomingState: IncomingStateFilter;
}) {
  const t = await getTranslations("Payments");
  const tFilter = await getTranslations("Payments.incomingFilter");

  return (
    <Card className="overflow-hidden bg-card">
      <CardHeader>
        <CardTitle>{t("incomingTitle")}</CardTitle>
        <CardDescription>{t("incomingDescription")}</CardDescription>
      </CardHeader>
      <TableFilterBar
        hrefFor={(next) =>
          paymentsSearchHref("/payments", pager.query, {
            incomingState: next === "all" ? "" : next,
            incoming: "1",
          })
        }
        options={[
          { value: "all", label: tFilter("all") },
          { value: "unmatched", label: tFilter("unmatched") },
          { value: "allocated", label: tFilter("allocated") },
        ]}
        value={incomingState}
      />
      <CardContent className="px-0 pt-0">
        {transactions.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            {t("incomingEmpty")}
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.date")}</TableHead>
                  <TableHead>{t("columns.from")}</TableHead>
                  <TableHead>{t("columns.vs")}</TableHead>
                  <TableHead className="text-right">
                    {t("columns.amount")}
                  </TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="text-muted-foreground">
                      {formatInvoiceDate(transaction.bookedDate, locale)}
                    </TableCell>
                    <TableCell className="max-w-48 truncate font-medium">
                      {transaction.counterpartyName ??
                        transaction.message ??
                        t("incomingFallback")}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {transaction.variableSymbol ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(
                        Number(transaction.amount),
                        transaction.currency,
                        locale,
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          transaction.allocated ? "secondary" : "outline"
                        }
                      >
                        {transaction.allocated
                          ? t("allocated")
                          : t("readyToMatch")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <LedgerPager pager={pager} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export async function PaymentsHistoryTable({
  allocations,
  locale,
  pager,
}: {
  allocations: AllocationHistoryRow[];
  locale: AppLocale;
  pager: PagerQuery;
}) {
  const t = await getTranslations("Payments");

  return (
    <Card className="overflow-hidden bg-card">
      <CardHeader>
        <CardTitle>{t("historyTitle")}</CardTitle>
        <CardDescription>{t("historyDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pt-0">
        {allocations.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            {t("historyEmpty")}
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.date")}</TableHead>
                  <TableHead>{t("columns.to")}</TableHead>
                  <TableHead>{t("columns.source")}</TableHead>
                  <TableHead className="text-right">
                    {t("columns.amount")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("columns.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((allocation) => (
                  <TableRow key={allocation.id}>
                    <TableCell className="text-muted-foreground">
                      {formatInvoiceDate(allocation.effectiveDate, locale)}
                    </TableCell>
                    <TableCell className="max-w-56 truncate">
                      {allocation.invoiceId ? (
                        <Link
                          href={`/invoices/${allocation.invoiceId}`}
                          className="font-medium hover:underline"
                        >
                          {allocation.invoiceNumber} · {allocation.clientName}
                        </Link>
                      ) : (
                        <Link
                          href={`/payments/requests/${allocation.paymentRequestId}`}
                          className="font-medium hover:underline"
                        >
                          {t("requestTarget", {
                            note:
                              allocation.paymentRequestMessage ??
                              t("requestUntitled"),
                          })}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {allocation.reversedAt
                        ? t("historyMetaReversed", {
                            date: formatInvoiceDate(
                              allocation.effectiveDate,
                              locale,
                            ),
                            source: allocation.sourceLabel,
                          })
                        : allocation.sourceLabel}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(
                        Number(allocation.amount),
                        allocation.currency,
                        locale,
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!allocation.reversedAt ? (
                        <form action={reversePayment}>
                          <input
                            type="hidden"
                            name="allocationId"
                            value={allocation.id}
                          />
                          <Button size="sm" type="submit" variant="ghost">
                            {t("reverse")}
                          </Button>
                        </form>
                      ) : (
                        <Badge variant="outline">{t("reversed")}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <LedgerPager pager={pager} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LedgerPager({ pager }: { pager: PagerQuery }) {
  return (
    <TablePager
      count={pager.count}
      from={pager.from}
      nextHref={
        pager.page < pager.pageCount
          ? paymentsSearchHref("/payments", pager.query, {
              [pager.pageKey]: String(pager.page + 1),
            })
          : null
      }
      page={pager.page}
      pageCount={pager.pageCount}
      previousHref={
        pager.page > 1
          ? paymentsSearchHref("/payments", pager.query, {
              [pager.pageKey]: String(pager.page - 1),
            })
          : null
      }
      to={pager.to}
    />
  );
}
