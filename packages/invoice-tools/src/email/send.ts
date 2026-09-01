import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  emailMessages,
  type EmailMessageStatus,
  type InvoiceyDb,
} from "@invoicey/db";
import type { EmailTemplateId } from "@invoicey/emails";

import { isValidEmailAddress, resolveTransactionalFrom } from "./from";
import { getEmailTransport, isEmailTransportConfigured } from "./resolve";
import type { EmailAttachment, EmailTransport } from "./types";

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
  /** Injected in tests; production uses `getEmailTransport()`. */
  transport?: EmailTransport;
};

export type SendTransactionalEmailResult = {
  messageId: string;
  providerMessageId: string;
  status: EmailMessageStatus;
};

/** Shared transport (web + MCP/Eve). Key check runs before DB insert. */
export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  const transport = input.transport ?? getEmailTransport();
  if (!input.transport && !isEmailTransportConfigured(transport.provider)) {
    if (transport.provider === "resend") {
      throw new Error("RESEND_API_KEY is not configured");
    }
    throw new Error("Email transport is not configured");
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

  const from = resolveTransactionalFrom({
    template: input.template,
    displayName: input.displayName,
    emailFrom: process.env.EMAIL_FROM,
    emailSystemFrom: process.env.EMAIL_SYSTEM_FROM,
  });
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
    fromDisplay: from.display,
    fromAddress: from.address,
    subject: input.subject,
    coverText: input.coverText ?? null,
    attachPdf: input.attachPdf ?? false,
    attachIsdoc: input.attachIsdoc ?? false,
    provider: transport.provider,
    status: "queued",
    createdBy: input.createdBy ?? null,
    lastEventAt: now,
    createdAt: now,
  });

  const tags: Record<string, string> = {
    workspace_id: input.workspaceId,
    message_id: messageId,
    template: input.template,
  };
  if (input.invoiceId) {
    tags.invoice_id = input.invoiceId;
  }

  try {
    const sent = await transport.send({
      from: from.header,
      to: [to],
      cc: cc.length > 0 ? cc : undefined,
      replyTo: replyTo ?? undefined,
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags,
      attachments: input.attachments,
    });

    await input.db
      .update(emailMessages)
      .set({
        providerMessageId: sent.providerMessageId,
        status: "sent",
        lastEventAt: new Date(),
      })
      .where(eq(emailMessages.id, messageId));

    return {
      messageId,
      providerMessageId: sent.providerMessageId,
      status: "sent",
    };
  } catch (error) {
    await input.db
      .update(emailMessages)
      .set({ status: "failed", lastEventAt: new Date() })
      .where(eq(emailMessages.id, messageId));
    throw error instanceof Error
      ? error
      : new Error("Email transport send failed");
  }
}
