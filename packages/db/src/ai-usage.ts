import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";
import { workspaces } from "./workspaces";

/** Surfaces that can emit AI usage events. */
export const AI_USAGE_PRODUCTS = ["web", "slack", "mcp"] as const;
export type AiUsageProduct = (typeof AI_USAGE_PRODUCTS)[number];

/** LLM burns tokens; MCP tool calls are activity-only. */
export const AI_USAGE_KINDS = ["llm", "tool_call"] as const;
export type AiUsageKind = (typeof AI_USAGE_KINDS)[number];

/** Bucket consumed when debiting LLM tokens (debit order: monthly → gifted → purchased). */
export const AI_TOKEN_BUCKETS = ["monthly", "gifted", "purchased"] as const;
export type AiTokenBucket = (typeof AI_TOKEN_BUCKETS)[number];

/** One-time gifted pool on workspace create. */
export const SIGNUP_GIFTED_TOKENS = 500_000;

/** Included free-tier monthly allowance (does not roll over). */
export const MONTHLY_INCLUDED_TOKENS = 1_000_000;

/** Monthly period length in days. */
export const AI_TOKEN_PERIOD_DAYS = 30;

/** Per-workspace AI token balances (ADR: workspace entitlement unit). */
export const aiTokenBalances = pgTable("ai_token_balances", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  giftedRemaining: bigint("gifted_remaining", { mode: "number" })
    .notNull()
    .default(0),
  monthlyRemaining: bigint("monthly_remaining", { mode: "number" })
    .notNull()
    .default(0),
  monthlyLimit: bigint("monthly_limit", { mode: "number" })
    .notNull()
    .default(MONTHLY_INCLUDED_TOKENS),
  purchasedRemaining: bigint("purchased_remaining", { mode: "number" })
    .notNull()
    .default(0),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Append-only usage / activity ledger. */
export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** web | slack | mcp */
    product: text("product").$type<AiUsageProduct>().notNull(),
    /** llm | tool_call */
    kind: text("kind").$type<AiUsageKind>().notNull(),
    model: text("model"),
    promptTokens: bigint("prompt_tokens", { mode: "number" })
      .notNull()
      .default(0),
    completionTokens: bigint("completion_tokens", { mode: "number" })
      .notNull()
      .default(0),
    totalTokens: bigint("total_tokens", { mode: "number" })
      .notNull()
      .default(0),
    /** monthly | gifted | purchased — null when kind is tool_call */
    bucketDebited: text("bucket_debited").$type<AiTokenBucket | null>(),
    toolName: text("tool_name"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("ai_usage_events_workspace_created_idx").on(
      t.workspaceId,
      t.createdAt,
    ),
    index("ai_usage_events_workspace_product_idx").on(t.workspaceId, t.product),
  ],
);

/** Compute the initial monthly window starting at `from` (defaults to now). */
export function aiTokenPeriodBounds(from: Date = new Date()): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodStart = new Date(from);
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + AI_TOKEN_PERIOD_DAYS);
  return { periodStart, periodEnd };
}

/** Row values for a newly created workspace balance. */
export function initialAiTokenBalanceValues(
  workspaceId: string,
  now = new Date(),
) {
  const { periodStart, periodEnd } = aiTokenPeriodBounds(now);
  return {
    workspaceId,
    giftedRemaining: SIGNUP_GIFTED_TOKENS,
    monthlyRemaining: MONTHLY_INCLUDED_TOKENS,
    monthlyLimit: MONTHLY_INCLUDED_TOKENS,
    purchasedRemaining: 0,
    periodStart,
    periodEnd,
    updatedAt: now,
  };
}
