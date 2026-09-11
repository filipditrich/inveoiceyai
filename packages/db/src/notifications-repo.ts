import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import type { InvoiceyDb } from "./create-db";
import {
  notificationDeliveries,
  notificationEvents,
  type NotificationEventPayload,
} from "./notification-schema";
import { pocketDevices } from "./pocket-schema";
import { withDbTransaction, type DbTransaction } from "./transaction";

export type NotificationEventInput = {
  workspaceId: string;
  type: string;
  subjectType: string;
  subjectId: string;
  dedupeKey: string;
  payload: NotificationEventPayload;
  occurredAt?: Date;
};

export async function enqueueNotificationEvent(
  database: Pick<DbTransaction, "insert">,
  input: NotificationEventInput,
): Promise<string | null> {
  const [event] = await database
    .insert(notificationEvents)
    .values({
      workspaceId: input.workspaceId,
      type: input.type,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      dedupeKey: input.dedupeKey,
      payloadJson: input.payload,
      occurredAt: input.occurredAt,
    })
    .onConflictDoNothing({ target: notificationEvents.dedupeKey })
    .returning({ id: notificationEvents.id });
  return event?.id ?? null;
}

export async function listPendingNotificationEvents(
  database: InvoiceyDb,
  input: { limit: number; workspaceId?: string },
) {
  const where = input.workspaceId
    ? and(
        isNull(notificationEvents.processedAt),
        eq(notificationEvents.workspaceId, input.workspaceId),
      )
    : isNull(notificationEvents.processedAt);
  return database
    .select()
    .from(notificationEvents)
    .where(where)
    .orderBy(asc(notificationEvents.occurredAt))
    .limit(input.limit);
}

export async function markNotificationEventProcessed(
  database: InvoiceyDb,
  eventId: string,
): Promise<void> {
  await database
    .update(notificationEvents)
    .set({
      processedAt: new Date(),
      attemptCount: sql`${notificationEvents.attemptCount} + 1`,
      lastError: null,
    })
    .where(eq(notificationEvents.id, eventId));
}

export async function markNotificationEventFailed(
  database: InvoiceyDb,
  eventId: string,
  error: string,
): Promise<void> {
  await database
    .update(notificationEvents)
    .set({
      attemptCount: sql`${notificationEvents.attemptCount} + 1`,
      lastError: error.slice(0, 500),
    })
    .where(eq(notificationEvents.id, eventId));
}

export type NewNotificationDelivery = {
  eventId: string;
  workspaceId: string;
  userId: string;
  deviceId?: string;
  channel: "in_app" | "push";
  destinationKey: string;
  title: string;
  body: string;
  actionPath: string;
  category: string;
};

export async function insertNotificationDeliveries(
  database: InvoiceyDb,
  deliveries: NewNotificationDelivery[],
): Promise<void> {
  if (deliveries.length === 0) return;
  await database
    .insert(notificationDeliveries)
    .values(
      deliveries.map((delivery) => ({
        ...delivery,
        status: delivery.channel === "in_app" ? "sent" : "pending",
        sentAt: delivery.channel === "in_app" ? new Date() : null,
      })),
    )
    .onConflictDoNothing({
      target: [
        notificationDeliveries.eventId,
        notificationDeliveries.userId,
        notificationDeliveries.channel,
        notificationDeliveries.destinationKey,
      ],
    });
}

export async function claimPendingPushDeliveries(limit: number) {
  return withDbTransaction(async (tx) => {
    const now = new Date();
    const candidates = await tx
      .select({ id: notificationDeliveries.id })
      .from(notificationDeliveries)
      .innerJoin(
        pocketDevices,
        eq(pocketDevices.id, notificationDeliveries.deviceId),
      )
      .where(
        and(
          eq(notificationDeliveries.channel, "push"),
          or(
            and(
              eq(notificationDeliveries.status, "pending"),
              lte(notificationDeliveries.nextAttemptAt, now),
            ),
            and(
              eq(notificationDeliveries.status, "processing"),
              lte(notificationDeliveries.leaseUntil, now),
            ),
          ),
          eq(pocketDevices.pushEnabled, true),
          isNotNull(pocketDevices.apnsToken),
          isNotNull(pocketDevices.apnsEnvironment),
          isNull(pocketDevices.revokedAt),
        ),
      )
      .orderBy(asc(notificationDeliveries.createdAt))
      .limit(limit)
      .for("update", { of: notificationDeliveries, skipLocked: true });
    const ids = candidates.map((candidate) => candidate.id);
    if (ids.length === 0) return [];
    await tx
      .update(notificationDeliveries)
      .set({
        status: "processing",
        leaseUntil: new Date(now.getTime() + 60_000),
        updatedAt: now,
      })
      .where(inArray(notificationDeliveries.id, ids));
    return tx
      .select({
        id: notificationDeliveries.id,
        deviceId: pocketDevices.id,
        token: pocketDevices.apnsToken,
        environment: pocketDevices.apnsEnvironment,
        title: notificationDeliveries.title,
        body: notificationDeliveries.body,
        actionPath: notificationDeliveries.actionPath,
        category: notificationDeliveries.category,
      })
      .from(notificationDeliveries)
      .innerJoin(
        pocketDevices,
        eq(pocketDevices.id, notificationDeliveries.deviceId),
      )
      .where(inArray(notificationDeliveries.id, ids));
  });
}

export async function markNotificationDeliverySent(
  database: InvoiceyDb,
  input: { deliveryId: string; providerMessageId: string | null },
): Promise<void> {
  await database
    .update(notificationDeliveries)
    .set({
      status: "sent",
      leaseUntil: null,
      providerMessageId: input.providerMessageId,
      sentAt: new Date(),
      attemptCount: sql`${notificationDeliveries.attemptCount} + 1`,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(notificationDeliveries.id, input.deliveryId));
}

export async function markNotificationDeliveryFailed(
  database: InvoiceyDb,
  input: { deliveryId: string; error: string; permanent: boolean },
): Promise<void> {
  await database
    .update(notificationDeliveries)
    .set({
      status: input.permanent ? "failed" : "pending",
      leaseUntil: null,
      attemptCount: sql`${notificationDeliveries.attemptCount} + 1`,
      nextAttemptAt: new Date(Date.now() + 60_000),
      lastError: input.error.slice(0, 500),
      updatedAt: new Date(),
    })
    .where(eq(notificationDeliveries.id, input.deliveryId));
}

export async function listUserNotifications(
  database: InvoiceyDb,
  input: { userId: string; workspaceId: string; limit: number },
) {
  return database
    .select({
      id: notificationDeliveries.id,
      title: notificationDeliveries.title,
      body: notificationDeliveries.body,
      actionPath: notificationDeliveries.actionPath,
      category: notificationDeliveries.category,
      readAt: notificationDeliveries.readAt,
      createdAt: notificationDeliveries.createdAt,
    })
    .from(notificationDeliveries)
    .where(
      and(
        eq(notificationDeliveries.userId, input.userId),
        eq(notificationDeliveries.workspaceId, input.workspaceId),
        eq(notificationDeliveries.channel, "in_app"),
      ),
    )
    .orderBy(desc(notificationDeliveries.createdAt))
    .limit(input.limit);
}

export async function markUserNotificationRead(
  database: InvoiceyDb,
  input: { id: string; userId: string; workspaceId: string },
): Promise<boolean> {
  const [row] = await database
    .update(notificationDeliveries)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(notificationDeliveries.id, input.id),
        eq(notificationDeliveries.userId, input.userId),
        eq(notificationDeliveries.workspaceId, input.workspaceId),
        eq(notificationDeliveries.channel, "in_app"),
      ),
    )
    .returning({ id: notificationDeliveries.id });
  return Boolean(row);
}
