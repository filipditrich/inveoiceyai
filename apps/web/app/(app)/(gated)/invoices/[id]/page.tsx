import {
  deleteInvoice,
  duplicateInvoice,
  issueSavedInvoice,
  markInvoicePaid,
  unmarkInvoicePaid,
} from "@/actions/invoices";
import { reversePayment } from "@/actions/payments";
import { InvoiceCancelSheet } from "@/components/invoices/invoice-cancel-sheet";
import { SaveRecurringSheet } from "@/components/invoices/save-recurring-sheet";
import { InvoiceEmailTimeline } from "@/components/invoices/invoice-email-timeline";
import { InvoiceLifecycleGuidance } from "@/components/invoices/invoice-lifecycle-guidance";
import { ProductToastTracker } from "@/features/c15t/product-toast-tracker";
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
import {
  InvoiceSchema,
  invoiceDisplayUnit,
} from "@invoicey/invoice-core/schema";
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
type Search = Promise<{ invalid?: string; toast?: string }>;

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
  const issuerVatPayer = payload?.success ? payload.data.issuer.vatPayer : true;
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
  const hasActivePayments = allocationRows.some(
    (allocation) => !allocation.reversedAt,
  );
  const cancellationBlocked = hasActivePayments || Number(row.paidAmount) > 0;
  const paymentSource = (source: string) => {
    if (source === "legacy_manual") return t("payments.sources.legacy_manual");
    if (source === "bank_confirmed")
      return t("payments.sources.bank_confirmed");
    if (source === "bank_transaction")
      return t("payments.sources.bank_transaction");
    if (source === "payment_run") return t("payments.sources.payment_run");
    if (source === "manual") return t("payments.sources.manual");
    return t("payments.sources.other");
  };
  const paymentState = (state: string) => {
    if (state === "partial") return t("payments.states.partial");
    if (state === "paid") return t("payments.states.paid");
    if (state === "overpaid") return t("payments.states.overpaid");
    return t("payments.states.unpaid");
  };

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
    <div className="space-y-6">
      <ProductToastTracker
        clearNewInvoiceRecoveryWorkspaceId={workspaceId}
        properties={{
          documentType: [
            "invoice",
            "proforma",
            "advance",
            "credit_note",
          ].includes(row.docType)
            ? (row.docType as
                "invoice" | "proforma" | "advance" | "credit_note")
            : undefined,
          currency: ["CZK", "EUR", "USD"].includes(row.currency)
            ? (row.currency as "CZK" | "EUR" | "USD")
            : undefined,
          hasIsdoc: Boolean(row.isdocUrl),
        }}
        successInvoiceId={id}
        toast={sp.toast ?? null}
      />
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        href="/invoices"
        prefetch
      >
        {t("backToList")}
      </Link>
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
              <InvoiceCancelSheet
                blockedByPayment={cancellationBlocked}
                invoiceId={id}
              />
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
          {sp.invalid === "cannot_cancel"
            ? t("cannotCancelError")
            : invalidMessage(tErrors, sp.invalid)}
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
          <dt className="text-muted-foreground">
            {issuerVatPayer ? t("duzp") : t("duzpNonPayer")}
          </dt>
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

      <InvoiceLifecycleGuidance
        displayStatus={displayStatus}
        paymentState={row.paymentState}
      />

      {row.issuedAt ? (
        <Card id="payment-ledger">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{t("payments.title")}</CardTitle>
                <CardDescription>{t("payments.description")}</CardDescription>
              </div>
              <Button
                render={<Link href="/payments" />}
                size="sm"
                variant="outline"
              >
                {t("payments.open")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">{t("payments.state")}</dt>
                <dd>{paymentState(row.paymentState)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("payments.allocated")}
                </dt>
                <dd className="tabular-nums">
                  {formatMoney(Number(row.paidAmount), row.currency, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("payments.outstanding")}
                </dt>
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
                {t("payments.empty")}
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
                        {formatInvoiceDate(allocation.effectiveDate, locale)} ·{" "}
                        {paymentSource(allocation.source)}
                        {allocation.reversedAt
                          ? ` · ${t("payments.reversed")}`
                          : ""}
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
                          {t("payments.reverse")}
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
        <>
          {/* Six numeric columns need 42rem; on a phone each line becomes a
              small stacked block instead of a sideways scroll. */}
          <ul className="space-y-2 md:hidden">
            {payload.data.items.map((it) => (
              <li className="rounded-md border p-3 text-sm" key={it.position}>
                <p className="font-medium">
                  <span className="text-muted-foreground mr-2 tabular-nums">
                    {it.position}.
                  </span>
                  {it.description}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">
                    {t("itemsHeader.quantity")}
                  </dt>
                  <dd className="text-right tabular-nums">
                    {it.quantity}{" "}
                    {invoiceDisplayUnit(it.unit, payload.data.meta.language)}
                  </dd>
                  <dt className="text-muted-foreground">
                    {issuerVatPayer
                      ? t("itemsHeader.price")
                      : t("itemsHeader.priceNonPayer")}
                  </dt>
                  <dd className="text-right tabular-nums">
                    {formatMoney(
                      it.unitPriceWithoutVat,
                      row.currency || "CZK",
                      locale,
                    )}
                  </dd>
                  {issuerVatPayer ? (
                    <>
                      <dt className="text-muted-foreground">
                        {t("itemsHeader.vat")}
                      </dt>
                      <dd className="text-right tabular-nums">
                        {it.vatRate} %
                      </dd>
                    </>
                  ) : null}
                  <dt className="font-medium">
                    {issuerVatPayer
                      ? t("itemsHeader.total")
                      : t("itemsHeader.totalNonPayer")}
                  </dt>
                  <dd className="text-right font-medium tabular-nums">
                    {formatMoney(it.lineTotal, row.currency || "CZK", locale)}
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden max-w-full overflow-x-auto rounded-md border md:block">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">{t("itemsHeader.position")}</th>
                  <th className="p-2">{t("itemsHeader.description")}</th>
                  <th className="p-2">{t("itemsHeader.quantity")}</th>
                  <th className="p-2">
                    {issuerVatPayer
                      ? t("itemsHeader.price")
                      : t("itemsHeader.priceNonPayer")}
                  </th>
                  {issuerVatPayer ? (
                    <th className="p-2">{t("itemsHeader.vat")}</th>
                  ) : null}
                  <th className="p-2">
                    {issuerVatPayer
                      ? t("itemsHeader.total")
                      : t("itemsHeader.totalNonPayer")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payload.data.items.map((it) => (
                  <tr className="border-b" key={it.position}>
                    <td className="p-2">{it.position}</td>
                    <td className="p-2">{it.description}</td>
                    <td className="p-2 tabular-nums">
                      {it.quantity}{" "}
                      {invoiceDisplayUnit(it.unit, payload.data.meta.language)}
                    </td>
                    <td className="p-2 tabular-nums">
                      {formatMoney(
                        it.unitPriceWithoutVat,
                        row.currency || "CZK",
                        locale,
                      )}
                    </td>
                    {issuerVatPayer ? (
                      <td className="p-2 tabular-nums">{it.vatRate} %</td>
                    ) : null}
                    <td className="p-2 tabular-nums">
                      {formatMoney(it.lineTotal, row.currency || "CZK", locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {!archive && payload && !payload.success ? (
        <p className="text-destructive text-sm">{t("invalidPayload")}</p>
      ) : null}

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
