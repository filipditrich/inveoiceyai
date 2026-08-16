import { createPaymentRunAction } from "@/actions/payment-runs";
import { IncomingInvoiceQueue } from "@/components/incoming-invoices/incoming-invoice-queue";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import { invalidMessage } from "@/lib/invalid-message";
import {
  approvalTasks,
  bankAccounts,
  incomingInvoices,
  issuerBusinesses,
  suppliers,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, desc, eq } from "drizzle-orm";
import { InboxIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

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
  const [t, tErrors, sp, { workspaceId, userId, role }] = await Promise.all([
    getTranslations("IncomingInvoices"),
    getTranslations("Errors.invalid"),
    searchParams,
    requireWorkspace(),
  ]);
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

  const myTasks = await db
    .select({ incomingInvoiceId: approvalTasks.incomingInvoiceId })
    .from(approvalTasks)
    .where(
      and(
        eq(approvalTasks.workspaceId, workspaceId),
        eq(approvalTasks.status, "pending"),
        eq(approvalTasks.assigneeUserId, userId),
      ),
    );
  const myTaskIds = new Set(myTasks.map((task) => task.incomingInvoiceId));

  const review = rows.filter((row) =>
    ["needs_review", "extract_failed"].includes(row.invoice.status),
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
    <div className="space-y-4 px-4 py-6 lg:px-6">
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
        counts={{
          review: review.length,
          approval: approval.length,
          pay: payables.length,
          all: rows.length,
        }}
        rows={visible.map((row) => ({
          id: row.invoice.id,
          number: row.invoice.number,
          supplierName: row.supplierName ?? row.invoice.supplierNameRaw,
          status: row.invoice.status,
          paymentState: row.invoice.paymentState,
          total: row.invoice.total,
          currency: row.invoice.currency,
          dueDate: row.invoice.dueDate,
          exceptions: row.invoice.exceptionCodes,
          mine: myTaskIds.has(row.invoice.id),
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
