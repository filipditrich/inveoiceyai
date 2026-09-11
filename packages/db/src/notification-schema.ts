import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";
import { pocketDevices } from "./pocket-schema";
import { workspaces } from "./workspaces";

export type NotificationEventPayload = {
  amount?: string;
  currency?: string;
  message?: string | null;
  variableSymbol?: string;
  allocationId?: string;
};

/** Durable domain fact waiting to be fanned out to notification channels. */
export const notificationEvents = pgTable(
  "notification_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    payloadJson: jsonb("payload_json")
      .$type<NotificationEventPayload>()
      .default({})
      .notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("notification_events_dedupe_uidx").on(table.dedupeKey),
    index("notification_events_pending_idx").on(
      table.processedAt,
      table.occurredAt,
    ),
    index("notification_events_workspace_idx").on(
      table.workspaceId,
      table.occurredAt,
    ),
  ],
);

/** One recipient/channel projection of a notification event. */
export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => notificationEvents.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => pocketDevices.id, {
      onDelete: "set null",
    }),
    channel: text("channel").notNull(),
    destinationKey: text("destination_key").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    actionPath: text("action_path").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    providerMessageId: text("provider_message_id"),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "notification_deliveries_channel_check",
      sql`${table.channel} IN ('in_app', 'push')`,
    ),
    check(
      "notification_deliveries_status_check",
      sql`${table.status} IN ('pending', 'processing', 'sent', 'failed')`,
    ),
    check(
      "notification_deliveries_device_check",
      sql`(${table.channel} = 'push' AND ${table.deviceId} IS NOT NULL) OR ${table.channel} = 'in_app'`,
    ),
    uniqueIndex("notification_deliveries_target_uidx").on(
      table.eventId,
      table.userId,
      table.channel,
      table.destinationKey,
    ),
    index("notification_deliveries_pending_idx").on(
      table.channel,
      table.status,
      table.nextAttemptAt,
      table.leaseUntil,
    ),
    index("notification_deliveries_inbox_idx").on(
      table.userId,
      table.channel,
      table.createdAt,
    ),
  ],
);
