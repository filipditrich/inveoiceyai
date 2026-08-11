import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import {
  emailEvents,
  emailMessages,
  emailSuppressions,
  type EmailMessageStatus,
  type InvoiceyDb,
} from "@invoicey/db";

import {
  eventKindToStatus,
  mergeEmailStatus,
  stripResendEventType,
  type ResendEventKind,
} from "./status";

type ResendWebhookPayload = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    tags?: Record<string, string> | { name: string; value: string }[];
    [key: string]: unknown;
  };
};

function tagsToRecord(
  tags:
    | Record<string, string>
    | { name: string; value: string }[]
    | undefined
    | null,
): Record<string, string> {
  if (!tags) return {};
  if (Array.isArray(tags)) {
    const out: Record<string, string> = {};
    for (const t of tags) {
      if (t?.name) out[t.name] = t.value;
    }
    return out;
  }
  return tags;
}

export async function applyResendWebhookEvent(opts: {
  db: InvoiceyDb;
  providerEventId: string;
  payload: ResendWebhookPayload;
}): Promise<
  { ok: true; kind: ResendEventKind | "ignored" } | { ok: false; error: string }
> {
  const kind = stripResendEventType(opts.payload.type);
  if (!kind) {
    return { ok: true, kind: "ignored" };
  }

  const [existing] = await opts.db
    .select({ id: emailEvents.id })
    .from(emailEvents)
    .where(eq(emailEvents.providerEventId, opts.providerEventId))
    .limit(1);
  if (existing) {
    return { ok: true, kind: "ignored" };
  }

  const tags = tagsToRecord(opts.payload.data?.tags);
  const messageId = tags.message_id;
  const providerMessageId = opts.payload.data?.email_id;

  let message =
    messageId != null
      ? (
          await opts.db
            .select()
            .from(emailMessages)
            .where(eq(emailMessages.id, messageId))
            .limit(1)
        )[0]
      : undefined;

  if (!message && providerMessageId) {
    message = (
      await opts.db
        .select()
        .from(emailMessages)
        .where(eq(emailMessages.providerMessageId, providerMessageId))
        .limit(1)
    )[0];
  }

  if (!message) {
    return { ok: false, error: "email message not found" };
  }

  const occurredAt = opts.payload.created_at
    ? new Date(opts.payload.created_at)
    : new Date();

  const statusPatch = eventKindToStatus(kind);
  const nextStatus = mergeEmailStatus(message.status, statusPatch);

  const patch: {
    status: EmailMessageStatus;
    lastEventAt: Date;
    openedAt?: Date;
    clickedAt?: Date;
  } = {
    status: nextStatus,
    lastEventAt: occurredAt,
  };
  if (kind === "opened" && !message.openedAt) {
    patch.openedAt = occurredAt;
  }
  if (kind === "clicked" && !message.clickedAt) {
    patch.clickedAt = occurredAt;
  }

  await opts.db.insert(emailEvents).values({
    id: randomUUID(),
    workspaceId: message.workspaceId,
    messageId: message.id,
    type: kind,
    providerEventId: opts.providerEventId,
    payloadJson: opts.payload as unknown as Record<string, unknown>,
    occurredAt,
  });

  await opts.db
    .update(emailMessages)
    .set(patch)
    .where(eq(emailMessages.id, message.id));

  if (kind === "bounced" || kind === "complained") {
    const reason = kind === "bounced" ? "bounce" : "complaint";
    const email = message.toEmail.toLowerCase();
    const [already] = await opts.db
      .select({ id: emailSuppressions.id })
      .from(emailSuppressions)
      .where(
        and(
          eq(emailSuppressions.workspaceId, message.workspaceId),
          eq(emailSuppressions.email, email),
        ),
      )
      .limit(1);
    if (!already) {
      await opts.db.insert(emailSuppressions).values({
        id: randomUUID(),
        workspaceId: message.workspaceId,
        email,
        reason,
      });
    }
  }

  return { ok: true, kind };
}
