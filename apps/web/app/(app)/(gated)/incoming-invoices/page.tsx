import { createPaymentRunAction } from "@/actions/payment-runs";
import { IncomingInvoiceQueue } from "@/components/incoming-invoices/incoming-invoice-queue";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/config";
import { requireWorkspace } from "@/lib/auth/session";
import { formatInvoiceDate, formatMoneyCode } from "@/lib/format";
import { incomingQueueCountsFromRows } from "@/lib/incoming-invoices/queue-counts";
import { payableEligibility } from "@/lib/incoming-invoices/eligibility";
import { invalidMessage } from "@/lib/invalid-message";
import {
  approvalTasks,
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
    })
    .from(incomingInvoices)
    .leftJoin(suppliers, eq(suppliers.id, incomingInvoices.supplierId))
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

  const counts = incomingQueueCountsFromRows(rows.map((row) => row.invoice));
  const review = rows.filter((row) =>
    ["needs_review", "extract_failed", "on_hold"].includes(row.invoice.status),
  );
  const approval = rows.filter(
    (row) => row.invoice.status === "pending_approval",
  );
  const payables = rows.filter(
    (row) =>
      row.invoice.status === "approved" &&
      row.invoice.paymentState !== "paid" &&
      row.invoice.docType !== "credit_note",
  );

  const issuers = await db
    .select({
      id: issuerBusinesses.id,
      snapshot: issuerBusinesses.snapshot,
    })
    .from(issuerBusinesses)
    .where(eq(issuerBusinesses.workspaceId, workspaceId));
  const accounts = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.workspaceId, workspaceId));
  const supplierAccounts = await db
    .select()
    .from(supplierBankAccounts)
    .where(eq(supplierBankAccounts.workspaceId, workspaceId));
  const supplierAccountById = new Map(
    supplierAccounts.map((account) => [account.id, account]),
  );

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
        rows={visible.map((row) => ({
          id: row.invoice.id,
          number: row.invoice.number,
          supplierName: row.supplierName ?? row.invoice.supplierNameRaw,
          status: row.invoice.status,
          paymentState: row.invoice.paymentState,
          total: row.invoice.total
            ? formatMoneyCode(
                Number(row.invoice.total),
                row.invoice.currency,
                appLocale,
              )
            : null,
          dueDate: formatInvoiceDate(row.invoice.dueDate, appLocale),
          exceptions: row.invoice.exceptionCodes,
          paymentBlockers: payableEligibility({
            status: row.invoice.status,
            holdUntil: row.invoice.holdUntil,
            paymentState: row.invoice.paymentState,
            outstanding: String(
              Math.max(
                0,
                Number(row.invoice.total ?? 0) -
                  Number(row.invoice.paidAmount ?? 0),
              ),
            ),
            currency: row.invoice.currency,
            runCurrency: "CZK",
            paymentMethod: row.invoice.paymentMethod,
            beneficiaryConfirmed: Boolean(
              supplierAccountById.get(row.invoice.supplierBankAccountId ?? "")
                ?.confirmedAt,
            ),
            hasBeneficiary: Boolean(
              row.invoice.beneficiaryIban ||
              (row.invoice.beneficiaryAccountNumber &&
                row.invoice.beneficiaryBankCode),
            ),
            iban: row.invoice.beneficiaryIban,
            accountNumber: row.invoice.beneficiaryAccountNumber,
            bankCode: row.invoice.beneficiaryBankCode,
            activePaymentRunId: row.invoice.activePaymentRunId,
            docType: row.invoice.docType,
          }),
          mine: myTaskIds.has(row.invoice.id),
          pendingTaskId: pendingTaskByInvoice.get(row.invoice.id)?.id ?? null,
        }))}
        canCreateRun={canCreateRun}
        issuers={issuers.map((issuer) => ({
          id: issuer.id,
          name:
            typeof issuer.snapshot.name === "string"
              ? issuer.snapshot.name
              : issuer.id.slice(0, 8),
        }))}
        bankAccounts={accounts.map((account) => ({
          id: account.id,
          label: account.displayName ?? account.iban,
          currency: account.currency,
        }))}
        createRunAction={createPaymentRunAction}
      />
    </div>
  );
}
