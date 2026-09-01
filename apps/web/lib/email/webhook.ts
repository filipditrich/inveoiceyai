import "server-only";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  emailEvents,
  emailMessages,
  emailSuppressions,
  type EmailMessageStatus,
  type InvoiceyDb,
} from "@invoicey/db";
import type {
  EmailDeliveryEventKind,
  NormalizedEmailDeliveryEvent,
} from "@invoicey/invoice-tools/email";

import { eventKindToStatus, mergeEmailStatus } from "./status";

/**
 * Apply a normalized delivery event. Duplicate `provider_event_id`s still
 * re-apply the message status patch so a failed update can recover on retry.
 */
export async function applyEmailDeliveryEvent(opts: {
  db: InvoiceyDb;
  event: NormalizedEmailDeliveryEvent;
}): Promise<
  | { ok: true; kind: EmailDeliveryEventKind | "ignored" }
  | { ok: false; error: string }
> {
  const { event } = opts;

  let message =
    event.messageId != null
      ? (
          await opts.db
            .select()
            .from(emailMessages)
            .where(eq(emailMessages.id, event.messageId))
            .limit(1)
        )[0]
      : undefined;

  if (!message && event.providerMessageId) {
    message = (
      await opts.db
        .select()
        .from(emailMessages)
        .where(eq(emailMessages.providerMessageId, event.providerMessageId))
        .limit(1)
    )[0];
  }

  if (!message) {
    return { ok: false, error: "email message not found" };
  }

  const statusPatch = eventKindToStatus(event.kind);
  const nextStatus = mergeEmailStatus(message.status, statusPatch);

  const patch: {
    status: EmailMessageStatus;
    lastEventAt: Date;
    openedAt?: Date;
    clickedAt?: Date;
  } = {
    status: nextStatus,
    lastEventAt: event.occurredAt,
  };
  if (event.kind === "opened" && !message.openedAt) {
    patch.openedAt = event.occurredAt;
  }
  if (event.kind === "clicked" && !message.clickedAt) {
    patch.clickedAt = event.occurredAt;
  }

  await opts.db
    .insert(emailEvents)
    .values({
      id: randomUUID(),
      workspaceId: message.workspaceId,
      messageId: message.id,
      type: event.kind,
      providerEventId: event.providerEventId,
      payloadJson: event.payload,
      occurredAt: event.occurredAt,
    })
    .onConflictDoNothing({ target: emailEvents.providerEventId });

  /** re-apply even when the event row already existed from a partial retry */
  await opts.db
    .update(emailMessages)
    .set(patch)
    .where(eq(emailMessages.id, message.id));

  if (event.kind === "bounced" || event.kind === "complained") {
    const reason = event.kind === "bounced" ? "bounce" : "complaint";
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

  return { ok: true, kind: event.kind };
}
