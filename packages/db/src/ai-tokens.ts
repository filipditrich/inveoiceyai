import { and, asc, desc, eq, lte, sql } from "drizzle-orm";

import {
  AI_TOKEN_PERIOD_DAYS,
  MONTHLY_INCLUDED_TOKENS,
  SIGNUP_GIFTED_TOKENS,
  aiTokenBalances,
  aiTokenPeriodBounds,
  aiUsageEvents,
  initialAiTokenBalanceValues,
  type AiTokenBucket,
  type AiUsageProduct,
} from "./ai-usage";
import { user } from "./auth-schema";
import type { InvoiceyDb } from "./create-db";
import type { DbTransaction } from "./transaction";
import { withDbTransaction } from "./transaction";

export { AI_TOKEN_PERIOD_DAYS, MONTHLY_INCLUDED_TOKENS, SIGNUP_GIFTED_TOKENS };

type DbOrTx = InvoiceyDb | DbTransaction;

export class OutOfAiTokensError extends Error {
  readonly code = "out_of_ai_tokens" as const;
  readonly usage?: RecordLlmUsageResult;

  constructor(
    message = "Workspace has no AI tokens remaining",
    usage?: RecordLlmUsageResult,
  ) {
    super(message);
    this.name = "OutOfAiTokensError";
    this.usage = usage;
  }
}

export type AiTokenSummary = {
  workspaceId: string;
  giftedRemaining: number;
  monthlyRemaining: number;
  monthlyLimit: number;
  purchasedRemaining: number;
  totalAvailable: number;
  periodStart: Date;
  periodEnd: Date;
  daysUntilRenewal: number;
};

function toSummary(row: typeof aiTokenBalances.$inferSelect): AiTokenSummary {
  const totalAvailable =
    row.giftedRemaining + row.monthlyRemaining + row.purchasedRemaining;
  const ms = row.periodEnd.getTime() - Date.now();
  const daysUntilRenewal = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  return {
    workspaceId: row.workspaceId,
    giftedRemaining: row.giftedRemaining,
    monthlyRemaining: row.monthlyRemaining,
    monthlyLimit: row.monthlyLimit,
    purchasedRemaining: row.purchasedRemaining,
    totalAvailable,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    daysUntilRenewal,
  };
}

/** Insert balance if missing (idempotent). */
export async function ensureAiTokenBalance(
  db: DbOrTx,
  workspaceId: string,
): Promise<void> {
  await db
    .insert(aiTokenBalances)
    .values(initialAiTokenBalanceValues(workspaceId))
    .onConflictDoNothing({ target: aiTokenBalances.workspaceId });
}

export async function getWorkspaceTokenSummary(
  db: DbOrTx,
  workspaceId: string,
): Promise<AiTokenSummary> {
  await ensureAiTokenBalance(db, workspaceId);
  const [row] = await db
    .select()
    .from(aiTokenBalances)
    .where(eq(aiTokenBalances.workspaceId, workspaceId))
    .limit(1);
  if (!row) {
    throw new Error(`ai_token_balances missing for ${workspaceId}`);
  }
  return toSummary(row);
}

export async function assertHasTokens(
  db: DbOrTx,
  workspaceId: string,
): Promise<AiTokenSummary> {
  const summary = await getWorkspaceTokenSummary(db, workspaceId);
  if (summary.totalAvailable <= 0) {
    throw new OutOfAiTokensError();
  }
  return summary;
}

function allocateDebit(
  remaining: {
    monthlyRemaining: number;
    giftedRemaining: number;
    purchasedRemaining: number;
  },
  amount: number,
): {
  monthlyRemaining: number;
  giftedRemaining: number;
  purchasedRemaining: number;
  primaryBucket: AiTokenBucket | null;
  debited: number;
} {
  let left = Math.max(0, Math.floor(amount));
  let monthly = remaining.monthlyRemaining;
  let gifted = remaining.giftedRemaining;
  let purchased = remaining.purchasedRemaining;
  let primaryBucket: AiTokenBucket | null = null;

  const take = (bucket: AiTokenBucket, available: number): number => {
    if (left <= 0 || available <= 0) return available;
    const used = Math.min(available, left);
    left -= used;
    if (used > 0 && primaryBucket == null) primaryBucket = bucket;
    return available - used;
  };

  monthly = take("monthly", monthly);
  gifted = take("gifted", gifted);
  purchased = take("purchased", purchased);

  return {
    monthlyRemaining: monthly,
    giftedRemaining: gifted,
    purchasedRemaining: purchased,
    primaryBucket,
    debited: Math.max(0, Math.floor(amount)) - left,
  };
}

export type RecordLlmUsageInput = {
  workspaceId: string;
  userId?: string | null;
  product: Exclude<AiUsageProduct, "mcp">;
  model?: string | null;
  promptTokens: number;
  completionTokens: number;
  metadata?: Record<string, unknown>;
};

export type RecordLlmUsageResult = {
  eventId: string;
  debited: number;
  bucketDebited: AiTokenBucket | null;
  summary: AiTokenSummary;
};

/** Drop ids that are not in `users` so Slack principals cannot roll back a debit. */
async function existingUserId(
  db: DbOrTx,
  userId: string | null | undefined,
): Promise<string | null> {
  const trimmed = userId?.trim();
  if (!trimmed) return null;
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, trimmed))
    .limit(1);
  return row?.id ?? null;
}

/** Atomically debit buckets (monthly → gifted → purchased) and append an llm event. */
export async function recordLlmUsage(
  input: RecordLlmUsageInput,
): Promise<RecordLlmUsageResult> {
  const promptTokens = Math.max(0, Math.floor(input.promptTokens));
  const completionTokens = Math.max(0, Math.floor(input.completionTokens));
  const totalTokens = promptTokens + completionTokens;

  const recorded = await withDbTransaction(async (tx) => {
    const userId = await existingUserId(tx, input.userId);
    await ensureAiTokenBalance(tx, input.workspaceId);

    const [locked] = await tx
      .select()
      .from(aiTokenBalances)
      .where(eq(aiTokenBalances.workspaceId, input.workspaceId))
      .for("update")
      .limit(1);

    if (!locked) {
      throw new Error(`ai_token_balances missing for ${input.workspaceId}`);
    }

    const next = allocateDebit(locked, totalTokens);
    if (totalTokens > 0 && next.debited === 0) {
      throw new OutOfAiTokensError();
    }

    const now = new Date();

    await tx
      .update(aiTokenBalances)
      .set({
        monthlyRemaining: next.monthlyRemaining,
        giftedRemaining: next.giftedRemaining,
        purchasedRemaining: next.purchasedRemaining,
        updatedAt: now,
      })
      .where(eq(aiTokenBalances.workspaceId, input.workspaceId));

    const eventId = crypto.randomUUID();
    await tx.insert(aiUsageEvents).values({
      id: eventId,
      workspaceId: input.workspaceId,
      userId,
      product: input.product,
      kind: "llm",
      model: input.model ?? null,
      promptTokens,
      completionTokens,
      totalTokens,
      bucketDebited: next.primaryBucket,
      toolName: null,
      metadata: input.metadata ?? {},
      createdAt: now,
    });

    const summary = toSummary({
      ...locked,
      monthlyRemaining: next.monthlyRemaining,
      giftedRemaining: next.giftedRemaining,
      purchasedRemaining: next.purchasedRemaining,
      updatedAt: now,
    });

    return {
      eventId,
      debited: next.debited,
      bucketDebited: next.primaryBucket,
      summary,
    };
  });

  if (recorded.debited < totalTokens) {
    throw new OutOfAiTokensError(
      "Workspace AI token balance is less than this usage",
      recorded,
    );
  }
  return recorded;
}

export type RecordToolActivityInput = {
  workspaceId: string;
  userId?: string | null;
  product?: "mcp";
  toolName: string;
  metadata?: Record<string, unknown>;
};

/** Log MCP (or similar) tool activity without debiting tokens. */
export async function recordToolActivity(
  db: DbOrTx,
  input: RecordToolActivityInput,
): Promise<{ eventId: string }> {
  await ensureAiTokenBalance(db, input.workspaceId);
  const userId = await existingUserId(db, input.userId);
  const eventId = crypto.randomUUID();
  await db.insert(aiUsageEvents).values({
    id: eventId,
    workspaceId: input.workspaceId,
    userId,
    product: input.product ?? "mcp",
    kind: "tool_call",
    model: null,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    bucketDebited: null,
    toolName: input.toolName,
    metadata: input.metadata ?? {},
    createdAt: new Date(),
  });
  return { eventId };
}

/** Reset monthly remaining to limit and advance the period. No rollover. */
export async function renewMonthlyPeriod(
  db: DbOrTx,
  workspaceId: string,
  now = new Date(),
): Promise<AiTokenSummary> {
  await ensureAiTokenBalance(db, workspaceId);
  const [row] = await db
    .select()
    .from(aiTokenBalances)
    .where(eq(aiTokenBalances.workspaceId, workspaceId))
    .limit(1);
  if (!row) {
    throw new Error(`ai_token_balances missing for ${workspaceId}`);
  }

  const limit = row.monthlyLimit || MONTHLY_INCLUDED_TOKENS;
  /** start next window at previous end when renewing on schedule */
  const base = row.periodEnd.getTime() <= now.getTime() ? row.periodEnd : now;
  const { periodStart, periodEnd } = aiTokenPeriodBounds(base);
  /** if still behind (missed renewals), jump to a fresh window from now */
  const bounds =
    periodEnd.getTime() <= now.getTime()
      ? aiTokenPeriodBounds(now)
      : { periodStart, periodEnd };

  await db
    .update(aiTokenBalances)
    .set({
      monthlyRemaining: limit,
      monthlyLimit: limit,
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
      updatedAt: now,
    })
    .where(eq(aiTokenBalances.workspaceId, workspaceId));

  return toSummary({
    ...row,
    monthlyRemaining: limit,
    monthlyLimit: limit,
    periodStart: bounds.periodStart,
    periodEnd: bounds.periodEnd,
    updatedAt: now,
  });
}

/** Renew every balance whose period has ended. Returns count renewed. */
export async function renewDueAiTokenPeriods(
  db: InvoiceyDb,
  now = new Date(),
): Promise<{ renewed: number; workspaceIds: string[] }> {
  const due = await db
    .select({ workspaceId: aiTokenBalances.workspaceId })
    .from(aiTokenBalances)
    .where(lte(aiTokenBalances.periodEnd, now))
    .orderBy(asc(aiTokenBalances.periodEnd));

  const workspaceIds: string[] = [];
  for (const row of due) {
    await renewMonthlyPeriod(db, row.workspaceId, now);
    workspaceIds.push(row.workspaceId);
  }
  return { renewed: workspaceIds.length, workspaceIds };
}

export type UsageEventListItem = {
  id: string;
  product: AiUsageProduct;
  kind: string;
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  bucketDebited: string | null;
  toolName: string | null;
  userId: string | null;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
};

export async function listAiUsageEvents(
  db: DbOrTx,
  opts: {
    workspaceId: string;
    limit?: number;
    offset?: number;
    product?: AiUsageProduct;
  },
): Promise<UsageEventListItem[]> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const conditions = [eq(aiUsageEvents.workspaceId, opts.workspaceId)];
  if (opts.product) {
    conditions.push(eq(aiUsageEvents.product, opts.product));
  }

  const rows = await db
    .select({
      id: aiUsageEvents.id,
      product: aiUsageEvents.product,
      kind: aiUsageEvents.kind,
      model: aiUsageEvents.model,
      promptTokens: aiUsageEvents.promptTokens,
      completionTokens: aiUsageEvents.completionTokens,
      totalTokens: aiUsageEvents.totalTokens,
      bucketDebited: aiUsageEvents.bucketDebited,
      toolName: aiUsageEvents.toolName,
      userId: aiUsageEvents.userId,
      createdAt: aiUsageEvents.createdAt,
      metadata: aiUsageEvents.metadata,
    })
    .from(aiUsageEvents)
    .where(and(...conditions))
    .orderBy(desc(aiUsageEvents.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    ...r,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
  }));
}

/** Daily token totals for charts (last N days). */
export async function aggregateAiUsageByDay(
  db: DbOrTx,
  opts: { workspaceId: string; days?: number },
): Promise<
  Array<{
    day: string;
    web: number;
    slack: number;
    mcp: number;
    total: number;
  }>
> {
  const days = opts.days ?? 30;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${aiUsageEvents.createdAt}), 'YYYY-MM-DD')`,
      product: aiUsageEvents.product,
      tokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
      calls: sql<number>`count(*)::int`,
    })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.workspaceId, opts.workspaceId),
        sql`${aiUsageEvents.createdAt} >= ${since}`,
      ),
    )
    .groupBy(
      sql`date_trunc('day', ${aiUsageEvents.createdAt})`,
      aiUsageEvents.product,
    );

  const byDay = new Map<
    string,
    { day: string; web: number; slack: number; mcp: number; total: number }
  >();

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { day: key, web: 0, slack: 0, mcp: 0, total: 0 });
  }

  for (const row of rows) {
    const bucket = byDay.get(row.day);
    if (!bucket) continue;
    /** MCP logs tool calls; chart uses call count so activity is visible */
    const value =
      row.product === "mcp" ? Number(row.calls) : Number(row.tokens);
    if (row.product === "web") bucket.web += value;
    else if (row.product === "slack") bucket.slack += value;
    else if (row.product === "mcp") bucket.mcp += value;
    bucket.total += value;
  }

  return [...byDay.values()];
}
