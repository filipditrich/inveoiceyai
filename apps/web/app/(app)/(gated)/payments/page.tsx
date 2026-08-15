import {
  bankTransactions,
  invoicePaymentAllocations,
  invoices,
  paymentMatchProposals,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { CheckIcon, LandmarkIcon, PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";

import {
  addManualPayment,
  confirmPaymentProposal,
  rejectPaymentProposal,
  reversePayment,
} from "@/actions/payments";
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

type Search = Promise<{
  error?: string;
  confirmed?: string;
  rejected?: string;
  added?: string;
  reversed?: string;
}>;

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

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const [{ workspaceId }, params] = await Promise.all([
    requireWorkspace(),
    searchParams,
  ]);
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
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-brand text-xs font-medium uppercase tracking-[0.14em]">
            Reconciliation
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Payments
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Bank transactions remain suggestions until you confirm an
            allocation. One invoice can receive partial payments and every
            reversal stays visible.
          </p>
        </div>
        <Button
          render={<Link href="/settings/bank-connections" />}
          variant="outline"
        >
          <LandmarkIcon /> Bank connections
        </Button>
      </div>

      {params.error ? (
        <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {params.error.replaceAll("_", " ")}
        </p>
      ) : params.confirmed ||
        params.rejected ||
        params.added ||
        params.reversed ? (
        <p className="border-brand/20 bg-brand/5 rounded-lg border px-4 py-3 text-sm">
          Payment ledger updated.
        </p>
      ) : null}

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
                className="flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {money(proposal.transactionAmount, proposal.currency)}
                    </span>
                    <Badge
                      variant={
                        proposal.confidence === "high" ? "default" : "secondary"
                      }
                    >
                      {proposal.confidence} · {proposal.score}
                    </Badge>
                  </div>
                  <p className="text-sm">
                    {proposal.counterpartyName ?? "Unknown sender"} →{" "}
                    <Link
                      href={`/invoices/${proposal.invoiceId}`}
                      className="text-brand hover:underline"
                    >
                      {proposal.invoiceNumber ?? "Draft"} ·{" "}
                      {proposal.clientName}
                    </Link>
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {proposal.bookedDate} · VS {proposal.variableSymbol ?? "—"}{" "}
                    · {proposal.reasons.join(", ").replaceAll("_", " ")}
                    {proposal.blockers.length
                      ? ` · ${proposal.blockers.join(", ").replaceAll("_", " ")}`
                      : ""}
                  </p>
                </div>
                <div className="flex gap-2">
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
                    <Button
                      type="submit"
                      variant="outline"
                      aria-label="Reject match"
                    >
                      <XIcon /> Reject
                    </Button>
                  </form>
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
                    <p className="text-muted-foreground text-xs">
                      {transaction.allocated ? "allocated" : "unallocated"}
                    </p>
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
                      {allocation.source.replaceAll("_", " ")}
                      {allocation.reversedAt ? " · reversed" : ""}
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
