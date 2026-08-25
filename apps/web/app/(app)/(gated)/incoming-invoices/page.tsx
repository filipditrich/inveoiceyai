import { createPaymentRunAction } from "@/actions/payment-runs";
import { IncomingInvoiceQueue } from "@/components/incoming-invoices/incoming-invoice-queue";
import { ProductToastTracker } from "@/features/c15t/product-toast-tracker";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/config";
import { requireWorkspace } from "@/lib/auth/session";
import { formatInvoiceDate, formatMoneyCode } from "@/lib/format";
import { payableEligibility } from "@/lib/incoming-invoices/eligibility";
import { incomingQueueCountsFromRows } from "@/lib/incoming-invoices/queue-counts";
import { invalidMessage } from "@/lib/invalid-message";
import {
  approvalTasks,
  bankAccountIssuers,
  bankAccounts,
  incomingInvoices,
  issuerBusinesses,
  supplierBankAccounts,
  suppliers,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, desc, eq } from "drizzle-orm";
import { InboxIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

type Search = Promise<{
  invalid?: string;
  toast?: string;
  tab?: string;
  q?: string;
}>;

export default async function IncomingInvoicesPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const [t, tErrors, sp, { workspaceId, userId, role }, locale] =
    await Promise.all([
      getTranslations("IncomingInvoices"),
      getTranslations("Errors.invalid"),
      searchParams,
      requireWorkspace(),
      getLocale(),
    ]);
  const appLocale = locale as AppLocale;
  const tab = sp.tab ?? "review";
  const rows = await db
    .select({
      invoice: incomingInvoices,
      supplierName: suppliers.name,
      beneficiaryConfirmed: supplierBankAccounts.confirmedAt,
    })
    .from(incomingInvoices)
    .leftJoin(suppliers, eq(suppliers.id, incomingInvoices.supplierId))
    .leftJoin(
      supplierBankAccounts,
      eq(incomingInvoices.supplierBankAccountId, supplierBankAccounts.id),
    )
    .where(eq(incomingInvoices.workspaceId, workspaceId))
    .orderBy(desc(incomingInvoices.createdAt))
    .limit(200);

  const pendingTasks = await db
    .select({
      id: approvalTasks.id,
      incomingInvoiceId: approvalTasks.incomingInvoiceId,
      assigneeUserId: approvalTasks.assigneeUserId,
    })
    .from(approvalTasks)
    .where(
      and(
        eq(approvalTasks.workspaceId, workspaceId),
        eq(approvalTasks.status, "pending"),
      ),
    );
  const pendingTaskByInvoice = new Map(
    pendingTasks.map((task) => [task.incomingInvoiceId, task]),
  );
  const myTaskIds = new Set(
    pendingTasks
      .filter((task) => task.assigneeUserId === userId)
      .map((task) => task.incomingInvoiceId),
  );

  const paymentEligibility = (row: (typeof rows)[number]) => ({
    status: row.invoice.status,
    holdUntil: row.invoice.holdUntil,
    paymentState: row.invoice.paymentState,
    outstanding: String(
      Math.max(
        0,
        Number(row.invoice.total ?? 0) - Number(row.invoice.paidAmount ?? 0),
      ),
    ),
    currency: row.invoice.currency,
    runCurrency: row.invoice.currency,
    paymentMethod: row.invoice.paymentMethod,
    beneficiaryConfirmed: Boolean(row.beneficiaryConfirmed),
    hasBeneficiary: Boolean(
      row.invoice.beneficiaryIban ||
      (row.invoice.beneficiaryAccountNumber && row.invoice.beneficiaryBankCode),
    ),
    iban: row.invoice.beneficiaryIban,
    accountNumber: row.invoice.beneficiaryAccountNumber,
    bankCode: row.invoice.beneficiaryBankCode,
    activePaymentRunId: row.invoice.activePaymentRunId,
    docType: row.invoice.docType,
  });
  const paymentBlockers = (row: (typeof rows)[number]) =>
    payableEligibility(paymentEligibility(row));
  const counts = incomingQueueCountsFromRows(rows.map(paymentEligibility));
  const review = rows.filter((row) =>
    ["needs_validation", "unsupported", "on_hold"].includes(row.invoice.status),
  );
  const approval = rows.filter(
    (row) => row.invoice.status === "pending_approval",
  );
  const payables = rows.filter((row) => paymentBlockers(row).length === 0);

  const [issuers, accounts, accountIssuerRows] = await Promise.all([
    db
      .select({
        id: issuerBusinesses.id,
        snapshot: issuerBusinesses.snapshot,
      })
      .from(issuerBusinesses)
      .where(eq(issuerBusinesses.workspaceId, workspaceId)),
    db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.workspaceId, workspaceId)),
    db
      .select({
        bankAccountId: bankAccountIssuers.bankAccountId,
        issuerId: bankAccountIssuers.issuerId,
      })
      .from(bankAccountIssuers)
      .where(eq(bankAccountIssuers.workspaceId, workspaceId)),
  ]);
  const issuerNameById = new Map(
    issuers.map((issuer) => [
      issuer.id,
      typeof issuer.snapshot.name === "string"
        ? issuer.snapshot.name
        : issuer.id.slice(0, 8),
    ]),
  );
  const issuerIdsByAccount = new Map<string, string[]>();
  for (const mapping of accountIssuerRows) {
    issuerIdsByAccount.set(mapping.bankAccountId, [
      ...(issuerIdsByAccount.get(mapping.bankAccountId) ?? []),
      mapping.issuerId,
    ]);
  }

  const visible =
    tab === "approval"
      ? approval
      : tab === "pay"
        ? payables
        : tab === "all"
          ? rows
          : review;

  const err = sp.invalid ? invalidMessage(tErrors, sp.invalid) : null;
  const canCreateRun = role === "admin" || role === "owner";

  return (
    <div className="space-y-4">
      <ProductToastTracker
        properties={{ routeKind: "incoming" }}
        toast={sp.toast ?? null}
      />
      <PageHeader
        icon={<InboxIcon />}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button render={<Link href="/incoming-invoices/upload" prefetch />}>
            <UploadIcon />
            {t("upload")}
          </Button>
        }
      />
      {err ? (
        <p className="text-destructive text-sm" role="alert">
          {err}
        </p>
      ) : null}
      <IncomingInvoiceQueue
        tab={tab}
        counts={counts}
        rows={visible.map((row) => {
          const blockers = paymentBlockers(row);
          return {
            id: row.invoice.id,
            number: row.invoice.number,
            supplierName: row.supplierName ?? row.invoice.supplierNameRaw,
            status: row.invoice.status,
            paymentState: row.invoice.paymentState,
            accountingState: row.invoice.accountingState,
            activePaymentRunId: row.invoice.activePaymentRunId,
            docType: row.invoice.docType,
            issuerId: row.invoice.issuerId,
            issuerName: row.invoice.issuerId
              ? (issuerNameById.get(row.invoice.issuerId) ??
                row.invoice.issuerId.slice(0, 8))
              : null,
            currency: row.invoice.currency,
            paymentEligible: blockers.length === 0,
            paymentBlocker: blockers[0] ?? null,
            total: row.invoice.total
              ? formatMoneyCode(
                  Number(row.invoice.total),
                  row.invoice.currency,
                  appLocale,
                )
              : null,
            dueDate: formatInvoiceDate(row.invoice.dueDate, appLocale),
            exceptions: row.invoice.exceptionCodes,
            mine: myTaskIds.has(row.invoice.id),
            pendingTaskId: pendingTaskByInvoice.get(row.invoice.id)?.id ?? null,
          };
        })}
        canCreateRun={canCreateRun}
        bankAccounts={accounts.map((account) => ({
          id: account.id,
          label: account.displayName ?? account.iban,
          currency: account.currency,
          issuerIds: issuerIdsByAccount.get(account.id) ?? [],
        }))}
        createRunAction={createPaymentRunAction}
      />
    </div>
  );
}
