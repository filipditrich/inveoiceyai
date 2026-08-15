import {
  bankTransactions,
  invoicePaymentAllocations,
  invoices,
  paymentMatchProposals,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
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
import Link from "next/link";

import {
  addManualPayment,
  confirmPaymentProposal,
  rejectPaymentProposal,
  reversePayment,
} from "@/actions/payments";
import { PageHeader } from "@/components/layout/page-header";
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
import { requireWorkspace } from "@/lib/auth/session";

function todayPrague(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function money(value: string, currency: string): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency,
  }).format(Number(value));
}

const REASON_LABELS: Record<string, string> = {
  receiving_account: "Receiving account matches",
  currency: "Currency matches",
  exact_variable_symbol: "Exact variable symbol",
  exact_outstanding_amount: "Exact amount due",
  partial_amount: "Partial payment",
  overpayment: "Payment is higher than amount due",
  known_client_account: "Recognized client account",
  plausible_date: "Payment date fits",
};

function matchLabel(proposal: {
  confidence: string;
  score: number;
  blockers: string[];
  reasons: string[];
}): string {
  if (
    proposal.score === 100 &&
    proposal.confidence === "high" &&
    proposal.blockers.length === 0 &&
    proposal.reasons.includes("exact_variable_symbol") &&
    proposal.reasons.includes("exact_outstanding_amount")
  ) {
    return "Exact match";
  }
  if (proposal.confidence === "high") return "Strong match";
  if (proposal.confidence === "medium") return "Likely match";
  return "Needs a careful review";
}

function allocationSource(source: string): string {
  if (source === "bank_confirmed") return "Matched from bank";
  if (source === "manual") return "Added manually";
  return source.replaceAll("_", " ");
}

export default async function PaymentsPage() {
  const { workspaceId } = await requireWorkspace();
  const [proposals, transactions, allocations, outstandingInvoices] =
    await Promise.all([
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
        .innerJoin(
          invoices,
          eq(invoices.id, invoicePaymentAllocations.invoiceId),
        )
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

  return (
    <div className="space-y-4 px-4 py-6 lg:px-6">
      <PageHeader
        actions={
          <Button
            render={<Link href="/settings/bank-connections" />}
            variant="outline"
          >
            <LandmarkIcon /> Bank connections
          </Button>
        }
        description={
          <>
            Bank transactions remain suggestions until you confirm an
            allocation. One invoice can receive partial payments and every
            reversal stays visible.
          </>
        }
        eyebrow="Reconciliation"
        icon={<LandmarkIcon />}
        title="Payments"
      />

      <Card>
        <CardHeader>
          <CardTitle>Suggested matches</CardTitle>
          <CardDescription>
            Deterministic proposals based on receiving IBAN, currency, variable
            symbol, outstanding amount, and date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {proposals.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">
              No payment matches need review.
            </p>
          ) : (
            proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="from-brand/[0.07] relative overflow-hidden rounded-2xl border bg-gradient-to-br via-transparent to-transparent p-4 sm:p-5"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xl font-semibold tabular-nums">
                        {money(proposal.transactionAmount, proposal.currency)}
                      </span>
                      <Badge className="gap-1" variant="default">
                        <SparklesIcon className="size-3" />
                        {matchLabel(proposal)}
                      </Badge>
                    </div>
                    <div className="mt-3 flex min-w-0 items-center gap-2 text-sm">
                      <span className="truncate font-medium">
                        {proposal.counterpartyName ?? "Unknown sender"}
                      </span>
                      <ArrowRightIcon className="text-muted-foreground size-4 shrink-0" />
                      <Link
                        href={`/invoices/${proposal.invoiceId}`}
                        className="text-brand truncate font-medium hover:underline"
                      >
                        {proposal.invoiceNumber ?? "Draft"} ·{" "}
                        {proposal.clientName}
                      </Link>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="bg-muted/70 text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs">
                        <CalendarDaysIcon className="size-3.5" />
                        {proposal.bookedDate}
                      </span>
                      <span className="bg-muted/70 text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs">
                        <HashIcon className="size-3.5" />
                        VS {proposal.variableSymbol ?? "missing"}
                      </span>
                      {proposal.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-400"
                        >
                          <CheckCircle2Icon className="size-3.5" />
                          {REASON_LABELS[reason] ?? reason.replaceAll("_", " ")}
                        </span>
                      ))}
                    </div>
                    {proposal.blockers.length > 0 ? (
                      <p className="text-destructive mt-3 text-xs">
                        Please review:{" "}
                        {proposal.blockers.join(", ").replaceAll("_", " ")}
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
                        <CheckIcon /> Confirm{" "}
                        {money(proposal.amount, proposal.currency)}
                      </Button>
                    </form>
                    <form action={rejectPaymentProposal}>
                      <input
                        type="hidden"
                        name="proposalId"
                        value={proposal.id}
                      />
                      <Button type="submit" variant="outline">
                        <XIcon /> Not this invoice
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
          <CardTitle>Add a manual payment</CardTitle>
          <CardDescription>
            Use this for cash, an unconnected bank, or a correction. The entry
            is recorded in the same ledger as confirmed bank payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {outstandingInvoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No issued invoice is outstanding.
            </p>
          ) : (
            <form
              action={addManualPayment}
              className="grid gap-4 sm:grid-cols-4 sm:items-end"
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="invoiceId">Invoice</Label>
                <select
                  id="invoiceId"
                  name="invoiceId"
                  required
                  className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm"
                >
                  {outstandingInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.number} · {invoice.clientName} ·{" "}
                      {money(invoice.outstanding, invoice.currency)} open
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  name="amount"
                  inputMode="decimal"
                  required
                  placeholder="1000.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Paid on</Label>
                <Input
                  id="effectiveDate"
                  name="effectiveDate"
                  type="date"
                  required
                  defaultValue={todayPrague()}
                />
              </div>
              <Button type="submit" className="sm:col-start-4">
                <PlusIcon /> Add payment
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Incoming transactions</CardTitle>
            <CardDescription>Latest imported Fio credits.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {transactions.length === 0 ? (
              <p className="text-muted-foreground py-4 text-sm">
                No imported transactions yet.
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
                        "Incoming payment"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {transaction.bookedDate} · VS{" "}
                      {transaction.variableSymbol ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">
                      {money(transaction.amount, transaction.currency)}
                    </p>
                    <Badge
                      className="mt-1"
                      variant={transaction.allocated ? "secondary" : "outline"}
                    >
                      {transaction.allocated ? "Allocated" : "Ready to match"}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allocation history</CardTitle>
            <CardDescription>
              Confirmed, manual, and reversed ledger entries.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {allocations.length === 0 ? (
              <p className="text-muted-foreground py-4 text-sm">
                No allocations yet.
              </p>
            ) : (
              allocations.map((allocation) => (
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
                    <p className="text-muted-foreground text-xs">
                      {allocation.effectiveDate} ·{" "}
                      {allocationSource(allocation.source)}
                      {allocation.reversedAt ? " · Reversed" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">
                      {money(allocation.amount, allocation.currency)}
                    </span>
                    {!allocation.reversedAt ? (
                      <form action={reversePayment}>
                        <input
                          type="hidden"
                          name="allocationId"
                          value={allocation.id}
                        />
                        <Button type="submit" variant="ghost" size="sm">
                          Reverse
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
