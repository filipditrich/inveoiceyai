import {
  addManualPayment,
  confirmPaymentProposal,
  rejectPaymentProposal,
  reversePayment,
} from "@/actions/payments";
import { PageHeader } from "@/components/layout/page-header";
import { paymentMatchFactors } from "@/components/payments/payment-match-explanation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductToastTracker } from "@/features/c15t/product-toast-tracker";
import { isAppLocale } from "@/i18n/config";
import { requireWorkspace } from "@/lib/auth/session";
import { assertCan } from "@/lib/authz/can";
import { formatInvoiceDate, formatMoney } from "@/lib/format";
import { messageLookup } from "@/lib/i18n-lookup";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  CheckIcon,
  HashIcon,
  LandmarkIcon,
  PlusIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import Link from "next/link";

import {
  bankTransactions,
  invoicePaymentAllocations,
  invoices,
  paymentMatchProposals,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

import type { AppLocale } from "@/i18n/config";

function todayPrague(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function money(value: string, currency: string, locale: AppLocale): string {
  return formatMoney(Number(value), currency, locale);
}

function matchLabel(
  t: Awaited<ReturnType<typeof getTranslations>>,
  proposal: {
    confidence: string;
    score: number;
    blockers: string[];
    reasons: string[];
  },
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

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ toast?: string }>;
}) {
  await assertCan("payments:read");
  const { workspaceId } = await requireWorkspace();
  const [
    t,
    localeValue,
    messages,
    proposals,
    transactions,
    allocations,
    outstandingInvoices,
  ] = await Promise.all([
    getTranslations("Payments"),
    getLocale(),
    getMessages(),
    db
      .select({
        id: paymentMatchProposals.id,
        amount: paymentMatchProposals.proposedAmount,
        score: paymentMatchProposals.score,
        confidence: paymentMatchProposals.confidence,
        reasons: paymentMatchProposals.reasonCodes,
        blockers: paymentMatchProposals.blockerCodes,
        transactionAmount: bankTransactions.amount,
        bookedDate: bankTransactions.bookedDate,
        variableSymbol: bankTransactions.variableSymbol,
        counterpartyName: bankTransactions.counterpartyName,
        invoiceId: invoices.id,
        invoiceNumber: invoices.number,
        clientName: invoices.clientName,
        currency: invoices.currency,
      })
      .from(paymentMatchProposals)
      .innerJoin(
        bankTransactions,
        eq(bankTransactions.id, paymentMatchProposals.bankTransactionId),
      )
      .innerJoin(invoices, eq(invoices.id, paymentMatchProposals.invoiceId))
      .where(
        and(
          eq(paymentMatchProposals.workspaceId, workspaceId),
          eq(paymentMatchProposals.status, "pending"),
        ),
      )
      .orderBy(
        desc(paymentMatchProposals.score),
        desc(bankTransactions.bookedDate),
      ),
    db
      .select({
        id: bankTransactions.id,
        bookedDate: bankTransactions.bookedDate,
        amount: bankTransactions.amount,
        currency: bankTransactions.currency,
        variableSymbol: bankTransactions.variableSymbol,
        counterpartyName: bankTransactions.counterpartyName,
        message: bankTransactions.message,
        allocated: sql<boolean>`exists(select 1 from invoice_payment_allocations a where a.bank_transaction_id = ${bankTransactions.id} and a.reversed_at is null)`,
      })
      .from(bankTransactions)
      .where(eq(bankTransactions.workspaceId, workspaceId))
      .orderBy(
        desc(bankTransactions.bookedDate),
        desc(bankTransactions.createdAt),
      )
      .limit(50),
    db
      .select({
        id: invoicePaymentAllocations.id,
        invoiceId: invoicePaymentAllocations.invoiceId,
        invoiceNumber: invoices.number,
        clientName: invoices.clientName,
        amount: invoicePaymentAllocations.amount,
        currency: invoicePaymentAllocations.currency,
        effectiveDate: invoicePaymentAllocations.effectiveDate,
        source: invoicePaymentAllocations.source,
        reversedAt: invoicePaymentAllocations.reversedAt,
      })
      .from(invoicePaymentAllocations)
      .innerJoin(invoices, eq(invoices.id, invoicePaymentAllocations.invoiceId))
      .where(eq(invoicePaymentAllocations.workspaceId, workspaceId))
      .orderBy(desc(invoicePaymentAllocations.createdAt))
      .limit(50),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        clientName: invoices.clientName,
        currency: invoices.currency,
        outstanding: sql<string>`greatest(abs(${invoices.total}) - ${invoices.paidAmount}, 0)::text`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          isNull(invoices.cancelledAt),
          sql`${invoices.issuedAt} IS NOT NULL`,
          sql`${invoices.paidAmount} < abs(${invoices.total})`,
        ),
      )
      .orderBy(desc(invoices.issueDate)),
  ]);
  const sp = await searchParams;
  const locale: AppLocale = isAppLocale(localeValue) ? localeValue : "cs";

  return (
    <div className="space-y-4">
      <ProductToastTracker toast={sp.toast ?? null} />
      <PageHeader
        actions={
          <Button
            render={<Link href="/settings/workspace/bank-connections" />}
            variant="outline"
          >
            <LandmarkIcon /> {t("bankConnections")}
          </Button>
        }
        description={t("description")}
        eyebrow={t("eyebrow")}
        icon={<LandmarkIcon />}
        title={t("title")}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("suggestedTitle")}</CardTitle>
          <CardDescription>{t("suggestedDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {proposals.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {t("suggestedEmpty")}
            </p>
          ) : (
            proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-brand/[0.07] via-transparent to-transparent p-4 sm:p-5"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xl font-semibold tabular-nums">
                        {money(
                          proposal.transactionAmount,
                          proposal.currency,
                          locale,
                        )}
                      </span>
                      <Badge className="gap-1" variant="default">
                        <SparklesIcon className="size-3" />
                        {matchLabel(t, proposal)}
                      </Badge>
                    </div>
                    <div className="mt-3 flex min-w-0 items-center gap-2 text-sm">
                      <span className="truncate font-medium">
                        {proposal.counterpartyName ?? t("unknownSender")}
                      </span>
                      <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
                      <Link
                        href={`/invoices/${proposal.invoiceId}`}
                        className="truncate font-medium text-brand hover:underline"
                      >
                        {proposal.invoiceNumber ?? t("draft")} ·{" "}
                        {proposal.clientName}
                      </Link>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground">
                        <CalendarDaysIcon className="size-3.5" />
                        {formatInvoiceDate(proposal.bookedDate, locale)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground">
                        <HashIcon className="size-3.5" />
                        {t("vsLabel", {
                          value: proposal.variableSymbol ?? t("vsMissing"),
                        })}
                      </span>
                      {paymentMatchFactors(proposal.reasons).map((reason) => (
                        <span
                          key={reason}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-400"
                        >
                          <CheckCircle2Icon className="size-3.5" />
                          {messageLookup(messages.Payments.reasons, reason)}
                        </span>
                      ))}
                    </div>
                    {proposal.blockers.length > 0 ? (
                      <p className="mt-3 text-xs text-destructive">
                        {t("pleaseReview", {
                          details: proposal.blockers
                            .map((blocker) =>
                              messageLookup(
                                messages.Payments.blockers,
                                blocker,
                              ),
                            )
                            .join(", "),
                        })}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <form action={confirmPaymentProposal}>
                      <input
                        type="hidden"
                        name="proposalId"
                        value={proposal.id}
                      />
                      <Button type="submit">
                        <CheckIcon />{" "}
                        {t("confirmAmount", {
                          amount: money(
                            proposal.amount,
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
                      <Button type="submit" variant="outline">
                        <XIcon /> {t("notThisInvoice")}
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("manualTitle")}</CardTitle>
          <CardDescription>{t("manualDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {outstandingInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("manualEmpty")}</p>
          ) : (
            <form
              action={addManualPayment}
              className="grid gap-4 sm:grid-cols-4 sm:items-end"
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="invoiceId">{t("invoice")}</Label>
                <select
                  id="invoiceId"
                  name="invoiceId"
                  required
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {outstandingInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {t("invoiceOption", {
                        number: invoice.number ?? t("draft"),
                        client: invoice.clientName,
                        amount: money(
                          invoice.outstanding,
                          invoice.currency,
                          locale,
                        ),
                      })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">{t("amount")}</Label>
                <Input
                  id="amount"
                  name="amount"
                  inputMode="decimal"
                  required
                  placeholder="1000.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">{t("paidOn")}</Label>
                <Input
                  id="effectiveDate"
                  name="effectiveDate"
                  type="date"
                  required
                  defaultValue={todayPrague()}
                />
              </div>
              <Button type="submit" className="sm:col-start-4">
                <PlusIcon /> {t("addPayment")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("incomingTitle")}</CardTitle>
            <CardDescription>{t("incomingDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {transactions.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                {t("incomingEmpty")}
              </p>
            ) : (
              transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-start justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {transaction.counterpartyName ??
                        transaction.message ??
                        t("incomingFallback")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("incomingMeta", {
                        date: formatInvoiceDate(transaction.bookedDate, locale),
                        vs: transaction.variableSymbol ?? "—",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">
                      {money(transaction.amount, transaction.currency, locale)}
                    </p>
                    <Badge
                      className="mt-1"
                      variant={transaction.allocated ? "secondary" : "outline"}
                    >
                      {transaction.allocated
                        ? t("allocated")
                        : t("readyToMatch")}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("historyTitle")}</CardTitle>
            <CardDescription>{t("historyDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {allocations.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                {t("historyEmpty")}
              </p>
            ) : (
              allocations.map((allocation) => {
                const source = messageLookup(
                  messages.Payments.sources,
                  allocation.source,
                );
                return (
                  <div
                    key={allocation.id}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/invoices/${allocation.invoiceId}`}
                        className="truncate font-medium hover:underline"
                      >
                        {allocation.invoiceNumber} · {allocation.clientName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {allocation.reversedAt
                          ? t("historyMetaReversed", {
                              date: formatInvoiceDate(
                                allocation.effectiveDate,
                                locale,
                              ),
                              source,
                            })
                          : t("historyMeta", {
                              date: formatInvoiceDate(
                                allocation.effectiveDate,
                                locale,
                              ),
                              source,
                            })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums">
                        {money(allocation.amount, allocation.currency, locale)}
                      </span>
                      {!allocation.reversedAt ? (
                        <form action={reversePayment}>
                          <input
                            type="hidden"
                            name="allocationId"
                            value={allocation.id}
                          />
                          <Button type="submit" variant="ghost" size="sm">
                            {t("reverse")}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
