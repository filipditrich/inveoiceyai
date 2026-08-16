import {
  deleteIncomingInvoiceAction,
  updateIncomingInvoiceFields,
} from "@/actions/incoming-invoices";
import { IncomingDecisionBar } from "@/components/incoming-invoices/incoming-decision-bar";
import { IncomingExceptionBadge } from "@/components/incoming-invoices/incoming-exception-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/config";
import { requireWorkspace } from "@/lib/auth/session";
import { formatDateTime, formatMoneyCode } from "@/lib/format";
import { incomingPaymentStateMessageKey } from "@/lib/incoming-invoices/payment-state-message";
import { incomingStatusMessageKey } from "@/lib/incoming-invoices/status-message";
import { invalidMessage } from "@/lib/invalid-message";
import {
  approvalTasks,
  incomingDocuments,
  incomingInvoiceLines,
  incomingInvoices,
  paymentAuditEvents,
  suppliers,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, desc, eq } from "drizzle-orm";
import { FileTextIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

type Search = Promise<{ invalid?: string }>;

export default async function IncomingInvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Search;
}) {
  const { id } = await params;
  const [t, tStatus, tErrors, sp, { workspaceId }, locale] = await Promise.all([
    getTranslations("IncomingInvoices.detail"),
    getTranslations("IncomingInvoices"),
    getTranslations("Errors.invalid"),
    searchParams,
    requireWorkspace(),
    getLocale(),
  ]);
  const appLocale = locale as AppLocale;
  const [invoice] = await db
    .select()
    .from(incomingInvoices)
    .where(
      and(
        eq(incomingInvoices.id, id),
        eq(incomingInvoices.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!invoice) {
    notFound();
  }
  const [supplier] = invoice.supplierId
    ? await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, invoice.supplierId))
        .limit(1)
    : [];
  const [document] = invoice.primaryDocumentId
    ? await db
        .select()
        .from(incomingDocuments)
        .where(eq(incomingDocuments.id, invoice.primaryDocumentId))
        .limit(1)
    : [];
  const lines = await db
    .select()
    .from(incomingInvoiceLines)
    .where(eq(incomingInvoiceLines.incomingInvoiceId, invoice.id));
  const tasks = await db
    .select()
    .from(approvalTasks)
    .where(eq(approvalTasks.incomingInvoiceId, invoice.id));
  const audit = await db
    .select()
    .from(paymentAuditEvents)
    .where(
      and(
        eq(paymentAuditEvents.workspaceId, workspaceId),
        eq(paymentAuditEvents.entityType, "incoming_invoice"),
        eq(paymentAuditEvents.entityId, invoice.id),
      ),
    )
    .orderBy(desc(paymentAuditEvents.createdAt))
    .limit(20);

  const err = sp.invalid ? invalidMessage(tErrors, sp.invalid) : null;
  const editable =
    invoice.status === "needs_review" || invoice.status === "on_hold";
  const pendingTask = tasks.find((task) => task.status === "pending");
  const viewerUrl = document
    ? `/api/incoming-documents/${document.id}?disposition=inline`
    : null;
  const nextReview = await db
    .select({ id: incomingInvoices.id })
    .from(incomingInvoices)
    .where(
      and(
        eq(incomingInvoices.workspaceId, workspaceId),
        eq(incomingInvoices.status, "needs_review"),
      ),
    )
    .orderBy(desc(incomingInvoices.createdAt));
  const nextId = nextReview.find((row) => row.id !== invoice.id)?.id ?? null;
  const amount = invoice.total
    ? formatMoneyCode(Number(invoice.total), invoice.currency, appLocale)
    : null;

  return (
    <div className="space-y-4 px-4 py-6 lg:px-6">
      <PageHeader
        icon={<FileTextIcon />}
        title={invoice.number ?? t("untitled")}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{supplier?.name ?? invoice.supplierNameRaw ?? "—"}</span>
            {amount ? <span className="tabular-nums">{amount}</span> : null}
            <Badge variant="outline">
              {tStatus(incomingStatusMessageKey(invoice.status))}
            </Badge>
            <Badge variant="secondary">
              {tStatus(incomingPaymentStateMessageKey(invoice.paymentState))}
            </Badge>
          </span>
        }
      />
      {err ? (
        <p className="text-destructive text-sm" role="alert">
          {err}
        </p>
      ) : null}
      <IncomingDecisionBar
        invoiceId={invoice.id}
        status={invoice.status}
        pendingTaskId={pendingTask?.id}
        nextId={nextId}
      />
      {invoice.exceptionCodes.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="mb-2 text-sm font-semibold">{t("exceptions")}</h2>
          <ul className="flex flex-wrap gap-1">
            {invoice.exceptionCodes.map((code) => (
              <li key={code}>
                <IncomingExceptionBadge code={code} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-card min-h-[32rem] overflow-hidden rounded-xl border">
          {viewerUrl && document?.mimeType === "application/pdf" ? (
            <iframe
              title={t("document")}
              className="h-[40rem] w-full"
              src={viewerUrl}
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">
              {document ? document.fileName : t("noDocument")}
            </div>
          )}
        </section>
        <section className="space-y-4">
          <form
            action={updateIncomingInvoiceFields}
            className="bg-card space-y-3 rounded-xl border p-4"
          >
            <h2 className="text-sm font-semibold">{t("fields")}</h2>
            <input type="hidden" name="id" value={invoice.id} />
            <Field
              name="number"
              label={t("number")}
              defaultValue={invoice.number}
              disabled={!editable}
            />
            <Field
              name="issueDate"
              label={t("issueDate")}
              defaultValue={invoice.issueDate}
              disabled={!editable}
              type="date"
            />
            <Field
              name="dueDate"
              label={t("dueDate")}
              defaultValue={invoice.dueDate}
              disabled={!editable}
              type="date"
            />
            <Field
              name="currency"
              label={t("currency")}
              defaultValue={invoice.currency}
              disabled={!editable}
            />
            <Field
              name="total"
              label={t("total")}
              defaultValue={invoice.total}
              disabled={!editable}
            />
            <Field
              name="subtotal"
              label={t("subtotal")}
              defaultValue={invoice.subtotal}
              disabled={!editable}
            />
            <Field
              name="vatTotal"
              label={t("vatTotal")}
              defaultValue={invoice.vatTotal}
              disabled={!editable}
            />
            <Field
              name="variableSymbol"
              label={t("variableSymbol")}
              defaultValue={invoice.variableSymbol}
              disabled={!editable}
            />
            <Field
              name="beneficiaryIban"
              label={t("iban")}
              defaultValue={invoice.beneficiaryIban}
              disabled={!editable}
            />
            <Field
              name="notes"
              label={t("notes")}
              defaultValue={invoice.notes}
              disabled={!editable}
            />
            {editable ? <Button type="submit">{t("save")}</Button> : null}
          </form>
          {lines.length > 0 ? (
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">{t("line")}</th>
                    <th className="px-3 py-2">{t("lineTotal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-t">
                      <td className="px-3 py-2">{line.description}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {line.lineTotal
                          ? formatMoneyCode(
                              Number(line.lineTotal),
                              invoice.currency,
                              appLocale,
                            )
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <form action={deleteIncomingInvoiceAction}>
            <input type="hidden" name="id" value={invoice.id} />
            <Button type="submit" variant="ghost">
              {t("delete")}
            </Button>
          </form>
          {audit.length > 0 ? (
            <ol className="text-muted-foreground space-y-1 text-xs">
              <li className="text-foreground text-sm font-semibold">
                {t("activity")}
              </li>
              {audit.map((event) => (
                <li key={event.id}>
                  {formatDateTime(event.createdAt, appLocale)} · {event.action}
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  disabled,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
      />
    </div>
  );
}
