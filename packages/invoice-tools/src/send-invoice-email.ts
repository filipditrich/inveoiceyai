import {
  emailMessages,
  emailSuppressions,
  invoices,
  issuerBusinesses,
  tryCreateDbFromEnv,
  type EmailMessageStatus,
  type InvoiceyDb,
  type IssuerEmailSettings,
} from "@invoicey/db";
import {
  renderInvoiceSentEmail,
  renderPaymentReceivedEmail,
} from "@invoicey/emails";
import {
  InvoiceSchema,
  renderInvoicePdf,
  renderIsdoc,
  type Invoice,
} from "@invoicey/invoice-core";
import { and, desc, eq } from "drizzle-orm";

import { isValidEmailAddress, sendTransactionalEmail } from "./email-transport";
import {
  getInvoiceyRequestContext,
  resolveWorkspaceId,
} from "./workspace-context";

const DEFAULT_COVER =
  "Dobrý den,\n\nv příloze zasílám fakturu {number}.\n\nS pozdravem";
const DEFAULT_SUBJECT = "Faktura {number} — {issuerName}";

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

function formatTotalLabel(total: string | number, currency: string): string {
  const n = typeof total === "number" ? total : Number(total);
  const formatted = new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
  return `${formatted} ${currency}`;
}

export function resolveIssuerEmailSettings(
  raw: IssuerEmailSettings | null | undefined,
): Required<
  Pick<
    IssuerEmailSettings,
    | "defaultSubject"
    | "defaultCoverText"
    | "attachIsdocByDefault"
    | "displayNameTemplate"
    | "overdueRemindersEnabled"
    | "overdueReminderIntervalDays"
    | "sendPaymentReceivedEmail"
  >
> {
  return {
    defaultSubject: raw?.defaultSubject?.trim() || DEFAULT_SUBJECT,
    defaultCoverText: raw?.defaultCoverText?.trim() || DEFAULT_COVER,
    attachIsdocByDefault: raw?.attachIsdocByDefault !== false,
    displayNameTemplate:
      raw?.displayNameTemplate?.trim() || "{issuerName} via Invoicey",
    overdueRemindersEnabled: raw?.overdueRemindersEnabled === true,
    overdueReminderIntervalDays: raw?.overdueReminderIntervalDays ?? 7,
    sendPaymentReceivedEmail: raw?.sendPaymentReceivedEmail === true,
  };
}

async function fetchBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch attachment (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function buildAttachments(opts: {
  invoice: Invoice;
  pdfUrl: string | null;
  isdocUrl: string | null;
  attachIsdoc: boolean;
  number: string;
}): Promise<{ filename: string; content: Buffer; contentType?: string }[]> {
  const out: { filename: string; content: Buffer; contentType?: string }[] = [];
  const pdfName = `faktura-${opts.number}.pdf`;
  if (opts.pdfUrl) {
    out.push({
      filename: pdfName,
      content: await fetchBytes(opts.pdfUrl),
      contentType: "application/pdf",
    });
  } else {
    const rendered = await renderInvoicePdf(opts.invoice);
    out.push({
      filename: pdfName,
      content: Buffer.from(rendered),
      contentType: "application/pdf",
    });
  }
  if (opts.attachIsdoc) {
    const isdocName = `faktura-${opts.number}.isdoc`;
    if (opts.isdocUrl) {
      out.push({
        filename: isdocName,
        content: await fetchBytes(opts.isdocUrl),
        contentType: "application/xml",
      });
    } else {
      out.push({
        filename: isdocName,
        content: Buffer.from(renderIsdoc(opts.invoice), "utf8"),
        contentType: "application/xml",
      });
    }
  }
  return out;
}

export type SendInvoiceEmailByIdInput = {
  id: string;
  workspaceId?: string;
  to?: string;
  cc?: string[];
  subject?: string;
  coverText?: string;
  attachIsdoc?: boolean;
  displayName?: string;
  createdBy?: string | null;
};

export type SendInvoiceEmailByIdResult =
  | {
      ok: true;
      messageId: string;
      providerMessageId: string;
      to: string;
      status: EmailMessageStatus;
    }
  | { ok: false; error: string };

/** Send an issued invoice by email (PDF + optional ISDOC). */
export async function sendInvoiceEmailById(
  input: SendInvoiceEmailByIdInput,
): Promise<SendInvoiceEmailByIdResult> {
  const database = tryCreateDbFromEnv();
  if (!database) {
    return { ok: false, error: "DATABASE_URL is not set" };
  }
  const workspaceId = resolveWorkspaceId(input.workspaceId);

  const [row] = await database
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.id, input.id), eq(invoices.workspaceId, workspaceId)),
    )
    .limit(1);

  if (!row) return { ok: false, error: "invoice_not_found" };
  if (!row.issuedAt) return { ok: false, error: "invoice_not_issued" };
  if (row.cancelledAt) return { ok: false, error: "invoice_cancelled" };

  const parsed = InvoiceSchema.safeParse(row.payloadJson);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };
  const invoice = parsed.data;
  const number = row.number ?? invoice.meta.number;

  const [issuerRow] = await database
    .select()
    .from(issuerBusinesses)
    .where(
      and(
        eq(issuerBusinesses.id, row.issuerId),
        eq(issuerBusinesses.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  const settings = resolveIssuerEmailSettings(issuerRow?.emailSettings);
  const clientEmail =
    typeof invoice.client.contactEmail === "string"
      ? invoice.client.contactEmail
      : undefined;
  const to = (input.to ?? clientEmail ?? "").trim().toLowerCase();
  if (!to || !isValidEmailAddress(to)) {
    return { ok: false, error: "missing_recipient" };
  }

  const vars = {
    number,
    issuerName: invoice.issuer.name,
    clientName: invoice.client.name,
  };
  const coverText = applyTemplate(
    input.coverText?.trim() || settings.defaultCoverText,
    vars,
  );
  const subject = applyTemplate(
    input.subject?.trim() || settings.defaultSubject,
    vars,
  );
  const attachIsdoc = input.attachIsdoc ?? settings.attachIsdocByDefault;
  const displayName =
    input.displayName?.trim() ||
    applyTemplate(settings.displayNameTemplate, vars);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const rendered = await renderInvoiceSentEmail({
    coverText,
    number,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    totalLabel: formatTotalLabel(row.total, row.currency),
    clientName: row.clientName,
    issuerName: invoice.issuer.name,
    invoiceUrl: appUrl ? `${appUrl}/invoices/${row.id}` : undefined,
  });

  const attachments = await buildAttachments({
    invoice,
    pdfUrl: row.pdfUrl,
    isdocUrl: row.isdocUrl,
    attachIsdoc,
    number,
  });

  try {
    const result = await sendTransactionalEmail({
      db: database,
      workspaceId,
      template: "invoice_sent",
      to,
      cc: input.cc,
      replyTo: invoice.issuer.contactEmail,
      displayName,
      subject: subject || rendered.subject,
      html: rendered.html,
      text: rendered.text,
      coverText,
      invoiceId: row.id,
      attachPdf: true,
      attachIsdoc,
      attachments,
      createdBy: input.createdBy ?? getInvoiceyRequestContext()?.userId ?? null,
    });
    return {
      ok: true,
      messageId: result.messageId,
      providerMessageId: result.providerMessageId,
      to,
      status: result.status,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "send_failed",
    };
  }
}

export async function wasRecentlyReminded(opts: {
  db: InvoiceyDb;
  workspaceId: string;
  invoiceId: string;
  intervalDays: number;
}): Promise<boolean> {
  const [last] = await opts.db
    .select()
    .from(emailMessages)
    .where(
      and(
        eq(emailMessages.workspaceId, opts.workspaceId),
        eq(emailMessages.invoiceId, opts.invoiceId),
        eq(emailMessages.template, "overdue_reminder"),
      ),
    )
    .orderBy(desc(emailMessages.createdAt))
    .limit(1);
  if (!last) return false;
  return Date.now() - last.createdAt.getTime() < opts.intervalDays * 86_400_000;
}

export async function isEmailSuppressed(opts: {
  db: InvoiceyDb;
  workspaceId: string;
  email: string;
}): Promise<boolean> {
  const [row] = await opts.db
    .select({ id: emailSuppressions.id })
    .from(emailSuppressions)
    .where(
      and(
        eq(emailSuppressions.workspaceId, opts.workspaceId),
        eq(emailSuppressions.email, opts.email.toLowerCase()),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Payment-received notice after mark-paid when issuer opts in. */
export async function sendPaymentReceivedEmailIfEnabled(opts: {
  db?: InvoiceyDb;
  workspaceId?: string;
  invoiceId: string;
}): Promise<void> {
  const database = opts.db ?? tryCreateDbFromEnv();
  if (!database) return;
  const workspaceId = resolveWorkspaceId(opts.workspaceId);

  const [row] = await database
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, opts.invoiceId),
        eq(invoices.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!row?.issuedAt || row.cancelledAt) return;

  const [issuerRow] = await database
    .select()
    .from(issuerBusinesses)
    .where(
      and(
        eq(issuerBusinesses.id, row.issuerId),
        eq(issuerBusinesses.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const settings = resolveIssuerEmailSettings(issuerRow?.emailSettings);
  if (!settings.sendPaymentReceivedEmail) return;

  const parsed = InvoiceSchema.safeParse(row.payloadJson);
  if (!parsed.success) return;
  const invoice = parsed.data;
  const to = invoice.client.contactEmail?.trim().toLowerCase();
  if (!to || !isValidEmailAddress(to)) return;

  if (await isEmailSuppressed({ db: database, workspaceId, email: to })) {
    return;
  }

  const number = row.number ?? invoice.meta.number;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const rendered = await renderPaymentReceivedEmail({
    number,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    totalLabel: formatTotalLabel(row.total, row.currency),
    clientName: row.clientName,
    issuerName: invoice.issuer.name,
    invoiceUrl: appUrl ? `${appUrl}/invoices/${row.id}` : undefined,
  });

  await sendTransactionalEmail({
    db: database,
    workspaceId,
    template: "payment_received",
    to,
    replyTo: invoice.issuer.contactEmail,
    displayName: applyTemplate(settings.displayNameTemplate, {
      issuerName: invoice.issuer.name,
    }),
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    invoiceId: row.id,
  });
}

export {
  emailFromFamily,
  resolveTransactionalFrom,
  sendTransactionalEmail,
  type EmailAttachment,
  type EmailFromFamily,
  type ResolvedEmailFrom,
  type SendTransactionalEmailInput,
  type SendTransactionalEmailResult,
} from "./email-transport";
