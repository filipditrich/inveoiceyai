import {
  cancelInvoice,
  deleteInvoice,
  duplicateInvoice,
  issueSavedInvoice,
  markInvoicePaid,
  unmarkInvoicePaid,
} from "@/actions/invoices";
import { InvoiceEmailTimeline } from "@/components/invoices/invoice-email-timeline";
import { InvoicePdfPreview } from "@/components/invoices/invoice-pdf-preview";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { SendInvoiceEmailSheet } from "@/components/invoices/send-invoice-email-sheet";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDateCs, formatDateTime, formatMoney } from "@/lib/format";
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
  StampIcon,
  Trash2Icon,
  WalletCardsIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

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
                Archiv
              </span>
            ) : null}
            {row.importCompleteness === "full" ? (
              <span className="rounded border px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wide">
                Import
              </span>
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
              <SubmitButton pendingLabel="Vystavuji…" size="sm">
                <StampIcon data-icon="inline-start" />
                Vystavit
              </SubmitButton>
            </form>
          ) : null}
          {displayStatus === "unpaid" ||
          displayStatus === "overdue" ||
          displayStatus === "future" ? (
            <form action={markInvoicePaid}>
              <input name="id" type="hidden" value={id} />
              <SubmitButton pendingLabel="Ukládám…" size="sm">
                <WalletCardsIcon data-icon="inline-start" />
                Označit zaplaceno
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
              Upravit
            </Button>
          ) : null}
          <form action={duplicateInvoice}>
            <input name="id" type="hidden" value={id} />
            <SubmitButton pendingLabel="Duplikuji…" size="sm" variant="outline">
              <CopyIcon data-icon="inline-start" />
              Duplikovat
            </SubmitButton>
          </form>
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
                pendingLabel="Stornuji…"
                size="sm"
                variant="secondary"
              >
                <BanIcon data-icon="inline-start" />
                Stornovat
              </SubmitButton>
            </form>
          ) : null}
          {displayStatus === "paid" ? (
            <form action={unmarkInvoicePaid}>
              <input name="id" type="hidden" value={id} />
              <SubmitButton
                pendingLabel="Ukládám…"
                size="sm"
                variant="secondary"
              >
                <WalletCardsIcon data-icon="inline-start" />
                Zrušit zaplaceno
              </SubmitButton>
            </form>
          ) : null}
          {displayStatus === "draft" ? (
            <form action={deleteInvoice}>
              <input name="id" type="hidden" value={id} />
              <SubmitButton
                pendingLabel="Mazání…"
                size="sm"
                variant="destructive"
              >
                <Trash2Icon data-icon="inline-start" />
                Smazat
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      {sp.invalid ? (
        <p className="text-destructive text-sm">Chyba: {sp.invalid}</p>
      ) : null}

      {showPdfPreview ? (
        <div className="overflow-hidden rounded-md border">
          <InvoicePdfPreview
            emptyLabel="PDF zatím není k dispozici."
            url={`/api/invoices/${id}/pdf?disposition=inline`}
          />
        </div>
      ) : null}

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Datum vystavení</dt>
          <dd className="tabular-nums">{formatDateCs(row.issueDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Splatnost</dt>
          <dd className="tabular-nums">{formatDateCs(row.dueDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">DUZP</dt>
          <dd className="tabular-nums">{formatDateCs(row.duzp)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Měna</dt>
          <dd className="tabular-nums">{row.currency}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Celkem</dt>
          <dd className="tabular-nums">
            {formatMoney(Number(row.total) || 0, row.currency || "CZK")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Zaplaceno dne</dt>
          <dd>{row.paidAt ? formatDateTime(row.paidAt) : "—"}</dd>
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
          Archivní import — položky nejsou k dispozici. Originální PDF je výše.
        </p>
      ) : null}

      {payload?.success ? (
        <div className="max-w-full overflow-x-auto rounded-md border">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">#</th>
                <th className="p-2">Popis</th>
                <th className="p-2">Množství</th>
                <th className="p-2">Cena bez DPH</th>
                <th className="p-2">DPH</th>
                <th className="p-2">Celkem s DPH</th>
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
                    {formatMoney(it.unitPriceWithoutVat)}
                  </td>
                  <td className="p-2 tabular-nums">{it.vatRate} %</td>
                  <td className="p-2 tabular-nums">
                    {formatMoney(it.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!archive && payload && !payload.success ? (
        <p className="text-destructive text-sm">Neplatný payload v DB.</p>
      ) : null}

      <p>
        <Link className="text-sm underline" href="/invoices">
          ← Zpět na seznam
        </Link>
      </p>
    </div>
  );
}
