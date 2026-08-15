import {
  cancelInvoice,
  deleteInvoice,
  duplicateInvoice,
  issueSavedInvoice,
  markInvoicePaid,
  unmarkInvoicePaid,
} from "@/actions/invoices";
import { reversePayment } from "@/actions/payments";
import { SaveRecurringSheet } from "@/components/invoices/save-recurring-sheet";
import { InvoiceEmailTimeline } from "@/components/invoices/invoice-email-timeline";
import { InvoicePdfPreview } from "@/components/invoices/invoice-pdf-preview";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { SendInvoiceEmailSheet } from "@/components/invoices/send-invoice-email-sheet";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatInvoiceDate, formatDateTime, formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";
import { invalidMessage } from "@/lib/invalid-message";
import { pragueTodayIso } from "@/lib/invoice-status-sql";
import { requireWorkspace } from "@/lib/auth/session";
import { isEmailConfigured } from "@/lib/email/invite";
import {
  applyDisplayNameTemplate,
  buildViaInvoiceyDisplayName,
  parseEmailFrom,
} from "@/lib/email/from";
import {
  listEmailEventsForMessages,
  listInvoiceEmailMessages,
  resolveIssuerEmailSettings,
} from "@/lib/email/send-invoice";
import { env } from "@invoicey/env/server";
import {
  isArchivePayload,
  type InvoiceOriginProvider,
} from "@invoicey/invoice-core/import";
import { InvoiceSchema } from "@invoicey/invoice-core/schema";
import { resolveDisplayStatus } from "@invoicey/invoice-core/status-display";
import {
  emailSuppressions,
  invoices,
  issuerBusinesses,
  listInvoicePaymentAllocations,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import {
  BanIcon,
  CopyIcon,
  FileCodeIcon,
  FileDownIcon,
  PencilIcon,
  ReceiptTextIcon,
  RepeatIcon,
  StampIcon,
  Trash2Icon,
  WalletCardsIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

type Params = Promise<{ id: string }>;
type Search = Promise<{ invalid?: string }>;

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTranslations("Invoices.detail");
  const tOrigin = await getTranslations("Invoices.origin");
  const tErrors = await getTranslations("Errors.invalid");
  const locale = (await getLocale()) as AppLocale;
  const { workspaceId } = await requireWorkspace();
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    notFound();
  }

  const archive = isArchivePayload(row.payloadJson) ? row.payloadJson : null;
  const payload = archive ? null : InvoiceSchema.safeParse(row.payloadJson);
  const displayStatus = resolveDisplayStatus(
    {
      issuedAt: row.issuedAt,
      dueDate: row.dueDate,
      paidAt: row.paidAt,
      cancelledAt: row.cancelledAt,
      issueDate: row.issueDate,
    },
    pragueTodayIso(),
  );
  const originProvider = (row.originProvider ??
    (row.issuedAt ? "invoicey" : null)) as InvoiceOriginProvider | null;
  const originLabel =
    originProvider != null ? tOrigin(originProvider) : row.originLabel;

  const [issuerRow] = await db
    .select()
    .from(issuerBusinesses)
    .where(
      and(
        eq(issuerBusinesses.id, row.issuerId),
        eq(issuerBusinesses.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const emailSettings = resolveIssuerEmailSettings(
    issuerRow?.emailSettings,
    payload?.success ? payload.data.meta.language : "cs",
  );
  const clientEmail =
    payload?.success && typeof payload.data.client.contactEmail === "string"
      ? payload.data.client.contactEmail
      : "";
  const replyTo = payload?.success ? payload.data.issuer.contactEmail : "";
  const templateVars = {
    number: row.number ?? "DRAFT",
    issuerName: payload?.success ? payload.data.issuer.name : "Invoicey",
    clientName: row.clientName,
  };
  const defaultSubject = emailSettings.defaultSubject.replace(
    /\{(\w+)\}/g,
    (_, key: string) => templateVars[key as keyof typeof templateVars] ?? "",
  );
  const defaultCover = emailSettings.defaultCoverText.replace(
    /\{(\w+)\}/g,
    (_, key: string) => templateVars[key as keyof typeof templateVars] ?? "",
  );
  const fromPreview = `${buildViaInvoiceyDisplayName(
    applyDisplayNameTemplate(emailSettings.displayNameTemplate, templateVars),
  )} <${parseEmailFrom(env.EMAIL_FROM).address}>`;

  const emailRows = await listInvoiceEmailMessages({
    db,
    workspaceId,
    invoiceId: id,
  });
  const emailEvents = await listEmailEventsForMessages({
    db,
    messageIds: emailRows.map((m) => m.id),
  });
  const eventsByMessage = new Map<string, typeof emailEvents>();
  for (const ev of emailEvents) {
    const list = eventsByMessage.get(ev.messageId) ?? [];
    list.push(ev);
    eventsByMessage.set(ev.messageId, list);
  }

  const suppressedRows = await db
    .select({ email: emailSuppressions.email })
    .from(emailSuppressions)
    .where(eq(emailSuppressions.workspaceId, workspaceId));
  const suppressedEmails = suppressedRows.map((r) => r.email);
  const allocationRows = await listInvoicePaymentAllocations(
    db,
    workspaceId,
    id,
  );

  const canEmail =
    Boolean(row.issuedAt) && !row.cancelledAt && displayStatus !== "draft";
  const showPdfPreview = Boolean(row.issuedAt) || Boolean(payload?.success);
  const documentLanguage =
    payload?.success && payload.data.meta.language === "en" ? "en" : "cs";
  const showIsdoc =
    Boolean(row.isdocUrl) ||
    (!row.importCompleteness && Boolean(payload?.success));
  const headerDescription = (
    <div className="flex flex-wrap items-center gap-2">
      <span>{row.clientName}</span>
      <InvoiceStatusBadge status={displayStatus} />
      {row.importCompleteness === "archive" ? (
        <span className="rounded border px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wide">
          {t("archive")}
        </span>
      ) : null}
      {row.importCompleteness === "full" ? (
        <span className="rounded border px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wide">
          {t("import")}
        </span>
      ) : null}
      {row.recurringScheduleId ? (
        <Link className="text-xs underline" href="/invoices/recurring" prefetch>
          {t("fromRecurring")}
        </Link>
      ) : null}
      {originLabel ? (
        <span className="text-xs">
          {originLabel}
          {row.originVersion ? ` @${row.originVersion}` : ""}
        </span>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <PageHeader
        actions={
          <>
            {displayStatus === "draft" ? (
              <form action={issueSavedInvoice}>
                <input name="id" type="hidden" value={id} />
                <SubmitButton pendingLabel={t("issuingPending")} size="sm">
                  <StampIcon data-icon="inline-start" />
                  {t("issueButton")}
                </SubmitButton>
              </form>
            ) : null}
            {displayStatus === "unpaid" ||
            displayStatus === "overdue" ||
            displayStatus === "future" ? (
              <form action={markInvoicePaid}>
                <input name="id" type="hidden" value={id} />
                <SubmitButton pendingLabel={t("savingPending")} size="sm">
                  <WalletCardsIcon data-icon="inline-start" />
                  {t("markPaidButton")}
                </SubmitButton>
              </form>
            ) : null}

            <ButtonGroup>
              <Button
                render={<a href={`/api/invoices/${id}/pdf`} download />}
                size="sm"
                variant="outline"
              >
                <FileDownIcon data-icon="inline-start" />
                PDF
              </Button>
              {showIsdoc ? (
                <Button
                  render={<a href={`/api/invoices/${id}/isdoc`} download />}
                  size="sm"
                  variant="outline"
                >
                  <FileCodeIcon data-icon="inline-start" />
                  ISDOC
                </Button>
              ) : null}
            </ButtonGroup>

            {displayStatus === "draft" ? (
              <Button
                render={<Link href={`/invoices/${id}/edit`} prefetch />}
                size="sm"
                variant="outline"
              >
                <PencilIcon data-icon="inline-start" />
                {t("editButton")}
              </Button>
            ) : null}
            <form action={duplicateInvoice}>
              <input name="id" type="hidden" value={id} />
              <SubmitButton
                pendingLabel={t("duplicatingPending")}
                size="sm"
                variant="outline"
              >
                <CopyIcon data-icon="inline-start" />
                {t("duplicateButton")}
              </SubmitButton>
            </form>
            {row.docType === "invoice" && !archive ? (
              row.recurringScheduleId ? (
                <Button
                  render={<Link href="/invoices/recurring" prefetch />}
                  size="sm"
                  variant="outline"
                >
                  <RepeatIcon data-icon="inline-start" />
                  {t("viewSchedule")}
                </Button>
              ) : (
                <SaveRecurringSheet
                  defaultDayOfMonth={Math.min(
                    31,
                    Math.max(1, Number(row.issueDate.slice(8, 10)) || 1),
                  )}
                  defaultName={`${row.clientName} · ${row.number ?? "DRAFT"}`}
                  invoiceId={id}
                />
              )
            ) : null}
            {canEmail ? (
              <SendInvoiceEmailSheet
                defaultAttachIsdoc={emailSettings.attachIsdocByDefault}
                defaultCoverText={defaultCover}
                defaultSubject={defaultSubject}
                defaultTo={clientEmail}
                emailConfigured={isEmailConfigured()}
                fromPreview={fromPreview}
                invoiceId={id}
                replyTo={replyTo}
                suppressedEmails={suppressedEmails}
              />
            ) : null}

            {displayStatus === "unpaid" ||
            displayStatus === "overdue" ||
            displayStatus === "future" ? (
              <form action={cancelInvoice}>
                <input name="id" type="hidden" value={id} />
                <SubmitButton
                  pendingLabel={t("cancellingPending")}
                  size="sm"
                  variant="secondary"
                >
                  <BanIcon data-icon="inline-start" />
                  {t("cancelButton")}
                </SubmitButton>
              </form>
            ) : null}
            {displayStatus === "paid" ? (
              <form action={unmarkInvoicePaid}>
                <input name="id" type="hidden" value={id} />
                <SubmitButton
                  pendingLabel={t("savingPending")}
                  size="sm"
                  variant="secondary"
                >
                  <WalletCardsIcon data-icon="inline-start" />
                  {t("unmarkPaidButton")}
                </SubmitButton>
              </form>
            ) : null}
            {displayStatus === "draft" || displayStatus === "cancelled" ? (
              <form action={deleteInvoice}>
                <input name="id" type="hidden" value={id} />
                <SubmitButton
                  pendingLabel={t("deletingPending")}
                  size="sm"
                  variant="destructive"
                >
                  <Trash2Icon data-icon="inline-start" />
                  {t("deleteButton")}
                </SubmitButton>
              </form>
            ) : null}
          </>
        }
        description={headerDescription}
        icon={<ReceiptTextIcon />}
        title={<span className="tabular-nums">{row.number ?? "DRAFT"}</span>}
      />

      {sp.invalid ? (
        <p className="text-destructive text-sm">
          {invalidMessage(tErrors, sp.invalid)}
        </p>
      ) : null}

      <dl className="bg-card grid gap-x-8 gap-y-3 rounded-xl border p-4 text-sm shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t("issueDate")}</dt>
          <dd className="tabular-nums">
            {formatInvoiceDate(row.issueDate, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("dueDate")}</dt>
          <dd className="tabular-nums">
            {formatInvoiceDate(row.dueDate, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("duzp")}</dt>
          <dd className="tabular-nums">
            {formatInvoiceDate(row.duzp, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("currency")}</dt>
          <dd className="tabular-nums">{row.currency}</dd>
        </div>
        {payload?.success ? (
          <div>
            <dt className="text-muted-foreground">{t("documentLanguage")}</dt>
            <dd>
              {documentLanguage === "en" ? t("languageEn") : t("languageCs")}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground">{t("total")}</dt>
          <dd className="tabular-nums">
            {formatMoney(Number(row.total) || 0, row.currency || "CZK", locale)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("paidAt")}</dt>
          <dd>{row.paidAt ? formatDateTime(row.paidAt, locale) : "—"}</dd>
        </div>
      </dl>

      {row.issuedAt ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Payment ledger</CardTitle>
                <CardDescription>
                  Confirmed allocations are the source of truth for this
                  invoice.
                </CardDescription>
              </div>
              <Button
                render={<Link href="/payments" />}
                size="sm"
                variant="outline"
              >
                Open payments
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">State</dt>
                <dd className="capitalize">{row.paymentState}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Allocated</dt>
                <dd className="tabular-nums">
                  {formatMoney(Number(row.paidAmount), row.currency, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Outstanding</dt>
                <dd className="tabular-nums">
                  {formatMoney(
                    Math.max(
                      0,
                      Math.abs(Number(row.total)) - Number(row.paidAmount),
                    ),
                    row.currency,
                    locale,
                  )}
                </dd>
              </div>
            </dl>
            {allocationRows.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No payment has been allocated yet.
              </p>
            ) : (
              <div className="divide-y rounded-lg border px-3">
                {allocationRows.map((allocation) => (
                  <div
                    key={allocation.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium tabular-nums">
                        {formatMoney(
                          Number(allocation.amount),
                          allocation.currency,
                          locale,
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {allocation.effectiveDate} ·{" "}
                        {allocation.source.replaceAll("_", " ")}
                        {allocation.reversedAt ? " · reversed" : ""}
                      </p>
                    </div>
                    {!allocation.reversedAt ? (
                      <form action={reversePayment}>
                        <input
                          type="hidden"
                          name="allocationId"
                          value={allocation.id}
                        />
                        <input
                          type="hidden"
                          name="returnTo"
                          value={`/invoices/${id}`}
                        />
                        <Button type="submit" size="sm" variant="ghost">
                          Reverse
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <InvoiceEmailTimeline
        items={emailRows.map((m) => ({
          id: m.id,
          toEmail: m.toEmail,
          subject: m.subject,
          status: m.status,
          template: m.template,
          createdAt: m.createdAt,
          events: (eventsByMessage.get(m.id) ?? []).map((ev) => ({
            type: ev.type,
            occurredAt: ev.occurredAt,
          })),
        }))}
      />

      {archive ? (
        <p className="text-muted-foreground rounded-md border p-3 text-sm">
          {t("archiveNote")}
        </p>
      ) : null}

      {payload?.success ? (
        <div className="max-w-full overflow-x-auto rounded-md border">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">{t("itemsHeader.position")}</th>
                <th className="p-2">{t("itemsHeader.description")}</th>
                <th className="p-2">{t("itemsHeader.quantity")}</th>
                <th className="p-2">{t("itemsHeader.price")}</th>
                <th className="p-2">{t("itemsHeader.vat")}</th>
                <th className="p-2">{t("itemsHeader.total")}</th>
              </tr>
            </thead>
            <tbody>
              {payload.data.items.map((it) => (
                <tr className="border-b" key={it.position}>
                  <td className="p-2">{it.position}</td>
                  <td className="p-2">{it.description}</td>
                  <td className="p-2 tabular-nums">
                    {it.quantity} {it.unit}
                  </td>
                  <td className="p-2 tabular-nums">
                    {formatMoney(
                      it.unitPriceWithoutVat,
                      row.currency || "CZK",
                      locale,
                    )}
                  </td>
                  <td className="p-2 tabular-nums">{it.vatRate} %</td>
                  <td className="p-2 tabular-nums">
                    {formatMoney(it.lineTotal, row.currency || "CZK", locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!archive && payload && !payload.success ? (
        <p className="text-destructive text-sm">{t("invalidPayload")}</p>
      ) : null}

      <p>
        <Link className="text-sm underline" href="/invoices">
          {t("backToList")}
        </Link>
      </p>

      {showPdfPreview ? (
        <InvoicePdfPreview
          className="mx-auto max-w-xl shadow-sm"
          emptyLabel={t("pdfEmpty")}
          url={`/api/invoices/${id}/pdf?disposition=inline`}
        />
      ) : null}
    </div>
  );
}
