import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";
import { workspaces } from "./workspaces";

/** Surfaces that can emit AI usage events. */
export const AI_USAGE_PRODUCTS = [
  "web",
  "slack",
  "mcp",
  "incoming_invoice_extract",
] as const;
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

/** What caused a one-time token award (ADR 0037). */
export const TOKEN_GRANT_TRIGGERS = [
  "signup",
  "first_invoice_issued",
  "manual",
] as const;
export type TokenGrantTrigger = (typeof TOKEN_GRANT_TRIGGERS)[number];

/**
 * Append-only ledger of one-time token awards (ADR 0037).
 *
 * `(workspace_id, rule_key)` unique **is** the idempotency mechanism: applying
 * a grant is an insert-or-skip in the same transaction as the credit, so a
 * retried invoice issue cannot pay out twice and a retried notification cannot
 * fire twice. Plan rules use their declared key; platform-admin grants use
 * `manual:<uuid>`, so one table answers "how did this workspace get its
 * tokens" for every kind of award.
 */
export const workspaceTokenGrants = pgTable(
  "workspace_token_grants",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Plan rule key, or `manual:<uuid>`. Immutable once published. */
    ruleKey: text("rule_key").notNull(),
    trigger: text("trigger").$type<TokenGrantTrigger>().notNull(),
    bucket: text("bucket").$type<AiTokenBucket>().notNull(),
    tokens: bigint("tokens", { mode: "number" }).notNull(),
    /** Platform admin for a manual grant; null when a plan rule fired. */
    grantedBy: text("granted_by").references(() => user.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("workspace_token_grants_rule_uidx").on(
      t.workspaceId,
      t.ruleKey,
    ),
    index("workspace_token_grants_workspace_idx").on(
      t.workspaceId,
      t.createdAt,
    ),
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

/**
 * Row values for a newly created workspace balance.
 *
 * Both amounts come from the workspace's plan (ADR 0035); the module constants
 * are only the fallback for callers that have no plan in hand, such as the
 * seeded default workspace. A sponsored plan can legitimately grant zero
 * gifted tokens, so `0` must survive here — hence the explicit `??` rather than
 * a truthiness check.
 */
export function initialAiTokenBalanceValues(
  workspaceId: string,
  now = new Date(),
  plan?: { monthlyIncludedTokens?: number; signupGiftedTokens?: number },
) {
  const { periodStart, periodEnd } = aiTokenPeriodBounds(now);
  const monthly = plan?.monthlyIncludedTokens ?? MONTHLY_INCLUDED_TOKENS;
  return {
    workspaceId,
    giftedRemaining: plan?.signupGiftedTokens ?? SIGNUP_GIFTED_TOKENS,
    monthlyRemaining: monthly,
    monthlyLimit: monthly,
    purchasedRemaining: 0,
    periodStart,
    periodEnd,
    updatedAt: now,
  };
}
