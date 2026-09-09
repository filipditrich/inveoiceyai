import {
  confirmPaymentProposal,
  rejectPaymentProposal,
} from "@/actions/payments";
import { paymentMatchFactors } from "@/components/payments/payment-match-explanation";
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
import { messageLookup } from "@/lib/i18n-lookup";
import { paymentsSearchHref } from "@/lib/payments/page-query";
import { CheckIcon, XIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type { AppLocale } from "@/i18n/config";

export type SuggestedMatchRow = {
  id: string;
  amount: string;
  score: number;
  confidence: string;
  reasons: string[];
  blockers: string[];
  transactionAmount: string;
  bookedDate: string;
  variableSymbol: string | null;
  counterpartyName: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  clientName: string | null;
  currency: string;
  paymentRequestId: string | null;
  paymentRequestMessage: string | null;
};

function matchLabel(
  t: Awaited<ReturnType<typeof getTranslations>>,
  proposal: Pick<
    SuggestedMatchRow,
    "confidence" | "score" | "blockers" | "reasons"
  >,
): string {
  if (
    proposal.score === 100 &&
    proposal.confidence === "high" &&
    proposal.blockers.length === 0 &&
    proposal.reasons.includes("exact_variable_symbol") &&
    proposal.reasons.includes("exact_outstanding_amount")
  ) {
    return t("match.exact");
  }
  if (proposal.confidence === "high") return t("match.high");
  if (proposal.confidence === "medium") return t("match.medium");
  return t("match.low");
}

export async function PaymentsSuggestedTable({
  proposals,
  locale,
  reasonLabels,
  blockerLabels,
  page,
  pageCount,
  from,
  to,
  count,
  query,
}: {
  proposals: SuggestedMatchRow[];
  locale: AppLocale;
  reasonLabels: Record<string, string>;
  blockerLabels: Record<string, string>;
  page: number;
  pageCount: number;
  from: number;
  to: number;
  count: number;
  query: Record<string, string | undefined>;
}) {
  const t = await getTranslations("Payments");

  return (
    <Card className="overflow-hidden bg-card">
      <CardHeader>
        <CardTitle>{t("suggestedTitle")}</CardTitle>
        <CardDescription>{t("suggestedDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pt-0">
        {proposals.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            {t("suggestedEmpty")}
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.date")}</TableHead>
                  <TableHead>{t("columns.from")}</TableHead>
                  <TableHead>{t("columns.to")}</TableHead>
                  <TableHead>{t("columns.vs")}</TableHead>
                  <TableHead className="text-right">
                    {t("columns.amount")}
                  </TableHead>
                  <TableHead>{t("columns.match")}</TableHead>
                  <TableHead className="text-right">
                    {t("columns.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((proposal) => (
                  <TableRow key={proposal.id}>
                    <TableCell className="text-muted-foreground">
                      {formatInvoiceDate(proposal.bookedDate, locale)}
                    </TableCell>
                    <TableCell className="max-w-40 truncate font-medium">
                      {proposal.counterpartyName ?? t("unknownSender")}
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {proposal.invoiceId ? (
                        <Link
                          href={`/invoices/${proposal.invoiceId}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {proposal.invoiceNumber ?? t("draft")} ·{" "}
                          {proposal.clientName}
                        </Link>
                      ) : (
                        <Link
                          href={`/payments/requests/${proposal.paymentRequestId}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {t("requestTarget", {
                            note:
                              proposal.paymentRequestMessage ??
                              t("requestUntitled"),
                          })}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {proposal.variableSymbol ?? t("vsMissing")}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(
                        Number(proposal.transactionAmount),
                        proposal.currency,
                        locale,
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="secondary">
                          {matchLabel(t, proposal)}
                        </Badge>
                        <p className="max-w-56 truncate text-xs text-muted-foreground">
                          {paymentMatchFactors(proposal.reasons)
                            .map((reason) =>
                              messageLookup(reasonLabels, reason),
                            )
                            .join(" · ")}
                        </p>
                        {proposal.blockers.length > 0 ? (
                          <p className="text-xs text-destructive">
                            {t("pleaseReview", {
                              details: proposal.blockers
                                .map((blocker) =>
                                  messageLookup(blockerLabels, blocker),
                                )
                                .join(", "),
                            })}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <form action={confirmPaymentProposal}>
                          <input
                            type="hidden"
                            name="proposalId"
                            value={proposal.id}
                          />
                          <Button size="sm" type="submit">
                            <CheckIcon />
                            {t("confirmAmount", {
                              amount: formatMoney(
                                Number(proposal.amount),
                                proposal.currency,
                                locale,
                              ),
                            })}
                          </Button>
                        </form>
                        <form action={rejectPaymentProposal}>
                          <input
                            type="hidden"
                            name="proposalId"
                            value={proposal.id}
                          />
                          <Button size="sm" type="submit" variant="outline">
                            <XIcon />
                            {proposal.invoiceId
                              ? t("notThisInvoice")
                              : t("notThisRequest")}
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePager
              count={count}
              from={from}
              nextHref={
                page < pageCount
                  ? paymentsSearchHref("/payments", query, {
                      matches: String(page + 1),
                    })
                  : null
              }
              page={page}
              pageCount={pageCount}
              previousHref={
                page > 1
                  ? paymentsSearchHref("/payments", query, {
                      matches: String(page - 1),
                    })
                  : null
              }
              to={to}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
