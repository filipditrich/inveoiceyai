import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { BillingOfferKey } from "./billing-rules";
import { workspaces } from "./workspaces";

export const BILLING_PROVIDERS = ["polar"] as const;
export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

export const BILLING_ENVIRONMENTS = ["sandbox", "production"] as const;
export type BillingEnvironment = (typeof BILLING_ENVIRONMENTS)[number];

export const BILLING_WEBHOOK_STATES = [
  "received",
  "processed",
  "ignored",
  "failed",
] as const;
export type BillingWebhookState = (typeof BILLING_WEBHOOK_STATES)[number];

export const BILLING_ADJUSTMENT_KINDS = ["purchase", "refund"] as const;
export type BillingAdjustmentKind = (typeof BILLING_ADJUSTMENT_KINDS)[number];

export const billingCustomers = pgTable("billing_customers", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  provider: text("provider")
    .$type<BillingProvider>()
    .notNull()
    .default("polar"),
  environment: text("environment").$type<BillingEnvironment>().notNull(),
  providerCustomerId: text("provider_customer_id").notNull().unique(),
  providerExternalId: text("provider_external_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider")
      .$type<BillingProvider>()
      .notNull()
      .default("polar"),
    providerSubscriptionId: text("provider_subscription_id").notNull().unique(),
    providerProductId: text("provider_product_id").notNull(),
    offerKey: text("offer_key").$type<BillingOfferKey>().notNull(),
    status: text("status").notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    providerModifiedAt: timestamp("provider_modified_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("billing_subscriptions_workspace_idx").on(t.workspaceId)],
);

export const billingOrders = pgTable(
  "billing_orders",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider")
      .$type<BillingProvider>()
      .notNull()
      .default("polar"),
    providerOrderId: text("provider_order_id").notNull().unique(),
    providerProductId: text("provider_product_id").notNull(),
    offerKey: text("offer_key").$type<BillingOfferKey>().notNull(),
    billingReason: text("billing_reason").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    refundedAmount: integer("refunded_amount").notNull().default(0),
    checkoutId: text("checkout_id"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("billing_orders_workspace_idx").on(t.workspaceId)],
);

export const billingWebhookEvents = pgTable(
  "billing_webhook_events",
  {
    id: uuid("id").primaryKey(),
    provider: text("provider")
      .$type<BillingProvider>()
      .notNull()
      .default("polar"),
    providerEventId: text("provider_event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    state: text("state").$type<BillingWebhookState>().notNull(),
    error: text("error"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    index("billing_webhook_events_type_idx").on(t.eventType, t.receivedAt),
  ],
);

/**
 * Signed purchased-token ledger. Purchases are positive; refunds are negative.
 * Distinct from `workspace_token_grants`, which stays awards-only (ADR 0037).
 */
export const billingTokenAdjustments = pgTable(
  "billing_token_adjustments",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    providerOrderId: text("provider_order_id").notNull(),
    kind: text("kind").$type<BillingAdjustmentKind>().notNull(),
    tokens: bigint("tokens", { mode: "number" }).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("billing_token_adjustments_idem_uidx").on(t.idempotencyKey),
    index("billing_token_adjustments_order_idx").on(
      t.workspaceId,
      t.providerOrderId,
    ),
  ],
);
