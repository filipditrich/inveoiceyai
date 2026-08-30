import { desc, eq, sql } from "drizzle-orm";

import {
  aiTokenBalances,
  workspaceTokenGrants,
  type TokenGrantTrigger,
} from "./ai-usage";
import type { InvoiceyDb } from "./create-db";
import type { Entitlements, TokenGrantRule } from "./entitlements";
import type { DbTransaction } from "./transaction";
import { withDbTransaction } from "./transaction";

type DbOrTx = InvoiceyDb | DbTransaction;

export interface AppliedGrant {
  ruleKey: string;
  trigger: TokenGrantTrigger;
  tokens: number;
  /** True when this call actually credited; false when it was already claimed. */
  granted: boolean;
  /** Whether the plan asked for the award to be announced. */
  notify: boolean;
}

/**
 * Credits one grant, at most once per workspace, ever.
 *
 * The ledger insert and the balance credit share a transaction, and the unique
 * index on `(workspace_id, rule_key)` decides the race — so a retried issue, a
 * double-submitted form, and two concurrent requests all converge on exactly
 * one payout. The caller uses `granted` to decide whether to notify, which
 * means a retry cannot double-notify either.
 */
export async function applyGrantRule(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    ruleKey: string;
    trigger: TokenGrantTrigger;
    tokens: number;
    bucket?: "gifted" | "purchased";
    notify?: boolean;
    grantedBy?: string | null;
    note?: string | null;
  },
): Promise<AppliedGrant> {
  const bucket = input.bucket ?? "gifted";
  const result: AppliedGrant = {
    ruleKey: input.ruleKey,
    trigger: input.trigger,
    tokens: input.tokens,
    granted: false,
    notify: input.notify ?? false,
  };

  // `onConflictDoNothing` rather than a pre-read: a SELECT-then-INSERT would
  // let two concurrent callers both see "not granted" and both credit.
  const inserted = await tx
    .insert(workspaceTokenGrants)
    .values({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      ruleKey: input.ruleKey,
      trigger: input.trigger,
      bucket,
      tokens: input.tokens,
      grantedBy: input.grantedBy ?? null,
      note: input.note ?? null,
    })
    .onConflictDoNothing({
      target: [workspaceTokenGrants.workspaceId, workspaceTokenGrants.ruleKey],
    })
    .returning({ id: workspaceTokenGrants.id });

  if (inserted.length === 0) {
    return result;
  }

  // Increment in SQL rather than read-modify-write, so a concurrent debit in
  // the same window is not clobbered.
  const credit =
    bucket === "gifted"
      ? {
          giftedRemaining: sql`${aiTokenBalances.giftedRemaining} + ${input.tokens}`,
        }
      : {
          purchasedRemaining: sql`${aiTokenBalances.purchasedRemaining} + ${input.tokens}`,
        };

  await tx
    .update(aiTokenBalances)
    .set({ ...credit, updatedAt: new Date() })
    .where(eq(aiTokenBalances.workspaceId, input.workspaceId));

  return { ...result, granted: true };
}

/**
 * Applies every plan rule for one trigger. Returns only the grants that
 * actually fired, so the caller can announce them without re-checking.
 */
export async function applyTriggerGrants(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    entitlements: Pick<Entitlements, "ai">;
    trigger: Exclude<TokenGrantTrigger, "manual">;
  },
): Promise<AppliedGrant[]> {
  const rules = input.entitlements.ai.grants.filter(
    (rule: TokenGrantRule) => rule.trigger === input.trigger,
  );

  const applied: AppliedGrant[] = [];
  for (const rule of rules) {
    applied.push(
      await applyGrantRule(tx, {
        workspaceId: input.workspaceId,
        ruleKey: rule.key,
        trigger: rule.trigger,
        tokens: rule.tokens,
        bucket: rule.bucket,
        notify: rule.notify,
      }),
    );
  }
  return applied.filter((grant) => grant.granted);
}

/**
 * Platform-admin discretionary grant. Rides the same ledger as plan rules with
 * a unique `manual:<uuid>` key, so every award a workspace ever received is
 * one query away — which is the question support actually asks.
 */
export async function grantTokensManually(input: {
  workspaceId: string;
  tokens: number;
  grantedBy: string;
  note?: string | null;
}): Promise<AppliedGrant> {
  // Opens its own transaction: the ledger insert and the credit must not be
  // separable, and no caller has a useful outer transaction to join.
  return withDbTransaction((tx) =>
    applyGrantRule(tx, {
      workspaceId: input.workspaceId,
      // A fresh key every time — a discretionary grant is deliberately
      // repeatable, unlike a plan rule.
      ruleKey: `manual:${crypto.randomUUID()}`,
      trigger: "manual",
      tokens: input.tokens,
      bucket: "gifted",
      grantedBy: input.grantedBy,
      note: input.note ?? null,
    }),
  );
}

export interface TokenGrantListItem {
  id: string;
  ruleKey: string;
  trigger: TokenGrantTrigger;
  bucket: string;
  tokens: number;
  grantedBy: string | null;
  note: string | null;
  createdAt: Date;
}

/** Award history for a workspace, newest first. */
export async function listWorkspaceTokenGrants(
  db: DbOrTx,
  workspaceId: string,
  limit = 20,
): Promise<TokenGrantListItem[]> {
  return db
    .select()
    .from(workspaceTokenGrants)
    .where(eq(workspaceTokenGrants.workspaceId, workspaceId))
    .orderBy(desc(workspaceTokenGrants.createdAt))
    .limit(limit);
}
