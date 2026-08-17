/**
 * Provider-neutral email contracts. Resend is the first implementation
 * (ADR 0034); SES or another send + store-then-fetch inbound plugs in later.
 */

export const EMAIL_PROVIDERS = ["resend"] as const;

export type EmailProviderId = (typeof EMAIL_PROVIDERS)[number];

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type EmailTransportSendInput = {
  from: string;
  to: string[];
  cc?: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  tags: Record<string, string>;
  attachments?: EmailAttachment[];
};

export type EmailTransportSendResult = {
  provider: EmailProviderId;
  providerMessageId: string;
};

/** Outbound transactional send. Templates stay in `@invoicey/emails`. */
export interface EmailTransport {
  readonly provider: EmailProviderId;
  send(input: EmailTransportSendInput): Promise<EmailTransportSendResult>;
}

export type InboundAttachment = {
  filename: string;
  contentType: string;
  size?: number;
  downloadUrl?: string;
};

export type InboundReceivedEmail = {
  html?: string | null;
  text?: string | null;
  headers?: Record<string, string>;
  attachments?: InboundAttachment[];
};

export type NormalizedInboundNotification = {
  providerMessageId: string;
  recipient: string | null;
  fromAddress: string | null;
  subject: string | null;
};

/**
 * Inbound capture. Downstream of `inbox_items` must not know the provider
 * (ADR 0032).
 */
export interface InboundCaptureAdapter {
  readonly provider: EmailProviderId;
  fetchReceivedEmail(
    providerMessageId: string,
    fetchImpl?: typeof fetch,
  ): Promise<InboundReceivedEmail>;
}

export type EmailDeliveryEventKind =
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "bounced"
  | "failed"
  | "complained"
  | "opened"
  | "clicked";

export type NormalizedEmailDeliveryEvent = {
  kind: EmailDeliveryEventKind;
  providerEventId: string;
  providerMessageId?: string;
  messageId?: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
};
