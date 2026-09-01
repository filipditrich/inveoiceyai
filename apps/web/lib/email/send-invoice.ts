import "server-only";
import {
  applyDisplayNameTemplate,
  isValidEmailAddress,
} from "@/lib/email/from";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  emailEvents,
  emailMessages,
  invoices,
  issuerBusinesses,
  type InvoiceyDb,
} from "@invoicey/db";
import { renderOverdueReminderEmail } from "@invoicey/emails";
import {
  InvoiceSchema,
  renderInvoicePdf,
  renderIsdoc,
  toInvoiceIntlLocale,
  type Invoice,
} from "@invoicey/invoice-core";
import {
  isEmailSuppressed,
  resolveIssuerEmailSettings,
  sendTransactionalEmail,
  wasRecentlyReminded,
} from "@invoicey/invoice-tools/email";

import type { EmailAttachment } from "@/lib/email/send";

export {
  resolveIssuerEmailSettings,
  sendPaymentReceivedEmailIfEnabled,
} from "@invoicey/invoice-tools/email";

function formatTotalLabel(
  total: string | number,
  currency: string,
  language: Invoice["meta"]["language"],
): string {
  const n = typeof total === "number" ? total : Number(total);
  const formatted = new Intl.NumberFormat(toInvoiceIntlLocale(language), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
  return `${formatted} ${currency}`;
}

async function fetchBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch attachment (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function buildInvoiceAttachments(opts: {
  invoice: Invoice;
  pdfUrl: string | null;
  isdocUrl: string | null;
  attachIsdoc: boolean;
  number: string;
}): Promise<EmailAttachment[]> {
  const attachments: EmailAttachment[] = [];
  const pdfName = `faktura-${opts.number}.pdf`;
  if (opts.pdfUrl) {
    attachments.push({
      filename: pdfName,
      content: await fetchBytes(opts.pdfUrl),
      contentType: "application/pdf",
    });
  } else {
    const rendered = await renderInvoicePdf(opts.invoice);
    attachments.push({
      filename: pdfName,
      content: Buffer.from(rendered),
      contentType: "application/pdf",
    });
  }

  if (opts.attachIsdoc) {
    const isdocName = `faktura-${opts.number}.isdoc`;
    if (opts.isdocUrl) {
      attachments.push({
        filename: isdocName,
        content: await fetchBytes(opts.isdocUrl),
        contentType: "application/xml",
      });
    } else {
      attachments.push({
        filename: isdocName,
        content: Buffer.from(renderIsdoc(opts.invoice), "utf8"),
        contentType: "application/xml",
      });
    }
  }

  return attachments;
}

export type SendOverdueResult =
  | { ok: true; messageId: string; to: string }
  | { ok: false; error: string };

export async function sendOverdueReminderForInvoice(opts: {
  db: InvoiceyDb;
  workspaceId: string;
  invoiceId: string;
}): Promise<SendOverdueResult> {
  const [row] = await opts.db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, opts.invoiceId),
        eq(invoices.workspaceId, opts.workspaceId),
      ),
    )
    .limit(1);
  if (!row?.issuedAt || row.cancelledAt || row.paidAt) {
    return { ok: false, error: "not_eligible" };
  }

  const [issuerRow] = await opts.db
    .select()
    .from(issuerBusinesses)
    .where(
      and(
        eq(issuerBusinesses.id, row.issuerId),
        eq(issuerBusinesses.workspaceId, opts.workspaceId),
      ),
    )
    .limit(1);
  const parsed = InvoiceSchema.safeParse(row.payloadJson);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };
  const invoice = parsed.data;
  const settings = resolveIssuerEmailSettings(
    issuerRow?.emailSettings,
    invoice.meta.language,
  );
  if (!settings.overdueRemindersEnabled) {
    return { ok: false, error: "reminders_disabled" };
  }

  const to = invoice.client.contactEmail?.trim().toLowerCase();
  if (!to || !isValidEmailAddress(to)) {
    return { ok: false, error: "missing_recipient" };
  }

  if (
    await isEmailSuppressed({
      db: opts.db,
      workspaceId: opts.workspaceId,
      email: to,
    })
  ) {
    return { ok: false, error: "suppressed" };
  }

  if (
    await wasRecentlyReminded({
      db: opts.db,
      workspaceId: opts.workspaceId,
      invoiceId: row.id,
      intervalDays: settings.overdueReminderIntervalDays,
    })
  ) {
    return { ok: false, error: "reminder_window" };
  }

  const number = row.number ?? invoice.meta.number;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const rendered = await renderOverdueReminderEmail({
    number,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    totalLabel: formatTotalLabel(
      row.total,
      row.currency,
      invoice.meta.language,
    ),
    clientName: row.clientName,
    issuerName: invoice.issuer.name,
    invoiceUrl: appUrl ? `${appUrl}/invoices/${row.id}` : undefined,
    locale: invoice.meta.language,
  });

  const attachments = await buildInvoiceAttachments({
    invoice,
    pdfUrl: row.pdfUrl,
    isdocUrl: row.isdocUrl,
    attachIsdoc: settings.attachIsdocByDefault,
    number,
  });

  try {
    const result = await sendTransactionalEmail({
      db: opts.db,
      workspaceId: opts.workspaceId,
      template: "overdue_reminder",
      to,
      replyTo: invoice.issuer.contactEmail,
      displayName: applyDisplayNameTemplate(settings.displayNameTemplate, {
        issuerName: invoice.issuer.name,
      }),
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      invoiceId: row.id,
      attachPdf: true,
      attachIsdoc: settings.attachIsdocByDefault,
      attachments,
    });
    return { ok: true, messageId: result.messageId, to };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "send_failed",
    };
  }
}

export async function listInvoiceEmailMessages(opts: {
  db: InvoiceyDb;
  workspaceId: string;
  invoiceId: string;
}) {
  return opts.db
    .select()
    .from(emailMessages)
    .where(
      and(
        eq(emailMessages.workspaceId, opts.workspaceId),
        eq(emailMessages.invoiceId, opts.invoiceId),
      ),
    )
    .orderBy(desc(emailMessages.createdAt));
}

export async function listEmailEventsForMessages(opts: {
  db: InvoiceyDb;
  messageIds: string[];
}) {
  if (opts.messageIds.length === 0) return [];
  return opts.db
    .select()
    .from(emailEvents)
    .where(inArray(emailEvents.messageId, opts.messageIds))
    .orderBy(asc(emailEvents.occurredAt));
}

/** Issued unpaid invoices past due for issuers with reminders enabled. */
export async function listOverdueInvoiceIdsForReminders(opts: {
  db: InvoiceyDb;
  workspaceId: string;
  todayIso: string;
}): Promise<string[]> {
  const rows = await opts.db
    .select({
      id: invoices.id,
      issuerId: invoices.issuerId,
      dueDate: invoices.dueDate,
      issuedAt: invoices.issuedAt,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.workspaceId, opts.workspaceId),
        isNull(invoices.cancelledAt),
        isNull(invoices.paidAt),
      ),
    );

  const issuers = await opts.db
    .select()
    .from(issuerBusinesses)
    .where(eq(issuerBusinesses.workspaceId, opts.workspaceId));

  const enabled = new Set(
    issuers
      .filter(
        (i) =>
          resolveIssuerEmailSettings(i.emailSettings).overdueRemindersEnabled,
      )
      .map((i) => i.id),
  );

  return rows
    .filter(
      (r) =>
        Boolean(r.issuedAt) &&
        r.dueDate < opts.todayIso &&
        enabled.has(r.issuerId),
    )
    .map((r) => r.id);
}
