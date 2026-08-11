import { randomUUID } from "node:crypto";

import {
  emailMessages,
  type EmailMessageStatus,
  type InvoiceyDb,
} from "@invoicey/db";
import type { EmailTemplateId } from "@invoicey/emails";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

const DEFAULT_FROM = "Invoicey <invoices@mail.invoicey.ditrich.me>";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendTransactionalEmailInput = {
  db: InvoiceyDb;
  workspaceId: string;
  template: EmailTemplateId;
  to: string;
  cc?: string[];
  replyTo?: string | null;
  displayName: string;
  subject: string;
  html: string;
  text: string;
  coverText?: string | null;
  invoiceId?: string | null;
  attachPdf?: boolean;
  attachIsdoc?: boolean;
  attachments?: EmailAttachment[];
  createdBy?: string | null;
};

export type SendTransactionalEmailResult = {
  messageId: string;
  providerMessageId: string;
  status: EmailMessageStatus;
};

function isValidEmailAddress(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

function buildViaDisplay(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Invoicey";
  if (/via Invoicey$/i.test(cleaned)) return cleaned;
  return `${cleaned} via Invoicey`;
}

function parseFrom(raw: string | undefined | null): {
  display: string;
  address: string;
} {
  const fallback = {
    display: "Invoicey",
    address: "invoices@mail.invoicey.ditrich.me",
  };
  if (!raw?.trim()) return fallback;
  const match = raw.trim().match(/^(.*?)\s*<([^>]+)>$/);
  if (match?.[2] && EMAIL_RE.test(match[2].trim())) {
    return {
      display: match[1]?.trim() || "Invoicey",
      address: match[2].trim().toLowerCase(),
    };
  }
  if (EMAIL_RE.test(raw.trim())) {
    return { display: "Invoicey", address: raw.trim().toLowerCase() };
  }
  return fallback;
}

/** Shared Resend transport (web + MCP/Eve). Key check runs before DB insert. */
export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const to = input.to.trim().toLowerCase();
  if (!isValidEmailAddress(to)) {
    throw new Error("Invalid recipient email");
  }

  const cc = (input.cc ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => isValidEmailAddress(e));

  const replyTo = input.replyTo?.trim() || null;
  if (replyTo && !isValidEmailAddress(replyTo)) {
    throw new Error("Invalid reply-to email");
  }

  const fromParts = parseFrom(process.env.EMAIL_FROM ?? DEFAULT_FROM);
  const fromDisplay = buildViaDisplay(input.displayName);
  const fromHeader = `${fromDisplay} <${fromParts.address}>`;
  const messageId = randomUUID();
  const now = new Date();

  await input.db.insert(emailMessages).values({
    id: messageId,
    workspaceId: input.workspaceId,
    invoiceId: input.invoiceId ?? null,
    template: input.template,
    toEmail: to,
    ccEmails: cc,
    replyTo,
    fromDisplay,
    fromAddress: fromParts.address,
    subject: input.subject,
    coverText: input.coverText ?? null,
    attachPdf: input.attachPdf ?? false,
    attachIsdoc: input.attachIsdoc ?? false,
    provider: "resend",
    status: "queued",
    createdBy: input.createdBy ?? null,
    lastEventAt: now,
    createdAt: now,
  });

  const resend = new Resend(apiKey);
  const tags: { name: string; value: string }[] = [
    { name: "workspace_id", value: input.workspaceId },
    { name: "message_id", value: messageId },
    { name: "template", value: input.template },
  ];
  if (input.invoiceId) {
    tags.push({ name: "invoice_id", value: input.invoiceId });
  }

  const { data, error } = await resend.emails.send({
    from: fromHeader,
    to: [to],
    cc: cc.length > 0 ? cc : undefined,
    replyTo: replyTo ?? undefined,
    subject: input.subject,
    html: input.html,
    text: input.text,
    tags,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  if (error || !data?.id) {
    await input.db
      .update(emailMessages)
      .set({ status: "failed", lastEventAt: new Date() })
      .where(eq(emailMessages.id, messageId));
    throw new Error(error?.message ?? "Resend send failed");
  }

  await input.db
    .update(emailMessages)
    .set({
      providerMessageId: data.id,
      status: "sent",
      lastEventAt: new Date(),
    })
    .where(eq(emailMessages.id, messageId));

  return {
    messageId,
    providerMessageId: data.id,
    status: "sent",
  };
}

export { isValidEmailAddress, buildViaDisplay as buildViaInvoiceyDisplayName };
