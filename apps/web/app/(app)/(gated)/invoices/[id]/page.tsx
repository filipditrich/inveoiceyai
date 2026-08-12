import {
  cancelInvoice,
  deleteInvoice,
  duplicateInvoice,
  issueSavedInvoice,
  markInvoicePaid,
  unmarkInvoicePaid,
} from "@/actions/invoices";
import { SaveRecurringSheet } from "@/components/invoices/save-recurring-sheet";
import { InvoiceEmailTimeline } from "@/components/invoices/invoice-email-timeline";
import { InvoicePdfPreview } from "@/components/invoices/invoice-pdf-preview";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { SendInvoiceEmailSheet } from "@/components/invoices/send-invoice-email-sheet";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
  ORIGIN_PROVIDER_LABELS,
  type InvoiceOriginProvider,
} from "@invoicey/invoice-core/import";
import { InvoiceSchema } from "@invoicey/invoice-core/schema";
import { resolveDisplayStatus } from "@invoicey/invoice-core/status-display";
import { emailSuppressions, invoices, issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import {
  BanIcon,
  CopyIcon,
  FileCodeIcon,
  FileDownIcon,
  PencilIcon,
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
  const { workspaceId } = await requireWorkspace();
  const t = await getTranslations("Invoices.detail");
  const tErrors = await getTranslations("Errors.invalid");
  const locale = (await getLocale()) as AppLocale;
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
    originProvider != null
      ? (ORIGIN_PROVIDER_LABELS[originProvider] ?? row.originLabel)
      : row.originLabel;

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
  const emailSettings = resolveIssuerEmailSettings(issuerRow?.emailSettings);
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

  const canEmail =
    Boolean(row.issuedAt) && !row.cancelledAt && displayStatus !== "draft";
  const showPdfPreview = Boolean(row.issuedAt);
  const showIsdoc =
    Boolean(row.isdocUrl) ||
    (!row.importCompleteness && Boolean(payload?.success));

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tabular-nums tracking-tight">
            {row.number ?? "DRAFT"}
          </h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-2">
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
              <Link
                className="text-xs underline"
                href="/invoices/recurring"
                prefetch
              >
                {t("fromRecurring")}
              </Link>
            ) : null}
            {originLabel ? (
              <span className="text-xs">
                {originLabel}
                {row.originVersion ? ` @${row.originVersion}` : ""}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
                  28,
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
          {displayStatus === "draft" ? (
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
        </div>
      </div>

      {sp.invalid ? (
        <p className="text-destructive text-sm">
          {invalidMessage(tErrors, sp.invalid)}
        </p>
      ) : null}

      {showPdfPreview ? (
        <div className="overflow-hidden rounded-md border">
          <InvoicePdfPreview
            emptyLabel={t("pdfEmpty")}
            url={`/api/invoices/${id}/pdf?disposition=inline`}
          />
        </div>
      ) : null}

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
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
    </div>
  );
}
