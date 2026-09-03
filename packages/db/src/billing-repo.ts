import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { aiTokenBalances, initialAiTokenBalanceValues } from "./ai-usage";
import {
  isLiveSubscriptionStatus,
  isPlanOffer,
  isProjectedPolarSubscription,
  isTokenPackOffer,
  paidAccessEnded,
  planKeyForOffer,
  refundedTokenDelta,
  shouldResetMonthlyAllowance,
  showsCancelingBanner,
  showsPastDueBanner,
  tokenPackAmount,
  type BillingOfferKey,
} from "./billing-rules";
import {
  billingCustomers,
  billingOrders,
  billingSubscriptions,
  billingTokenAdjustments,
  billingWebhookEvents,
  type BillingEnvironment,
  type BillingWebhookState,
} from "./billing-schema";
import type { InvoiceyDb } from "./create-db";
import {
  assignWorkspacePlan,
  getDefaultPlan,
  getPlanByKey,
  getWorkspaceEntitlements,
} from "./plans-repo";
import type { DbTransaction } from "./transaction";
import { workspaces } from "./workspaces";

type DbOrTx = InvoiceyDb | DbTransaction;

export class BillingWorkspaceNotFoundError extends Error {
  readonly code = "billing_workspace_not_found" as const;
  constructor(workspaceId: string) {
    super(`No workspace for Polar customer ${workspaceId}`);
    this.name = "BillingWorkspaceNotFoundError";
  }
}

export type NormalizedCustomer = {
  providerCustomerId: string;
  externalId: string;
};

export type NormalizedSubscription = {
  providerSubscriptionId: string;
  providerProductId: string;
  offerKey: BillingOfferKey;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  endsAt: Date | null;
  endedAt: Date | null;
  modifiedAt: Date | null;
  customer: NormalizedCustomer;
};

export type NormalizedOrder = {
  providerOrderId: string;
  providerProductId: string;
  offerKey: BillingOfferKey;
  billingReason: string;
  amount: number;
  currency: string;
  refundedAmount: number;
  checkoutId: string | null;
  status: string;
  customer: NormalizedCustomer;
  subscription?: NormalizedSubscription;
};

export type NormalizedBillingEvent =
  | { kind: "order.paid"; order: NormalizedOrder }
  | { kind: "subscription.snapshot"; subscription: NormalizedSubscription }
  | { kind: "order.refunded"; order: NormalizedOrder }
  | { kind: "customer.upsert"; customer: NormalizedCustomer }
  | { kind: "ignored" };

export type ClaimWebhookResult =
  | { outcome: "duplicate" }
  | { outcome: "claimed"; eventId: string };

export async function claimWebhookEvent(
  db: DbOrTx,
  input: {
    providerEventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  },
): Promise<ClaimWebhookResult> {
  const eventId = crypto.randomUUID();
  const inserted = await db
    .insert(billingWebhookEvents)
    .values({
      id: eventId,
      providerEventId: input.providerEventId,
      eventType: input.eventType,
      payload: input.payload,
      state: "received",
    })
    .onConflictDoNothing()
    .returning();

  if (inserted.length === 0) return { outcome: "duplicate" };
  return { outcome: "claimed", eventId };
}

export async function finishWebhookEvent(
  db: DbOrTx,
  input: {
    eventId: string;
    state: Exclude<BillingWebhookState, "received">;
    error?: string | null;
  },
): Promise<void> {
  await db
    .update(billingWebhookEvents)
    .set({
      state: input.state,
      error: input.error ?? null,
      processedAt: new Date(),
    })
    .where(eq(billingWebhookEvents.id, input.eventId));
}

export async function applyNormalizedBillingEvent(
  db: DbOrTx,
  input: {
    environment: BillingEnvironment;
    event: NormalizedBillingEvent;
  },
): Promise<{ applied: boolean; reason: string }> {
  if (input.event.kind === "ignored") {
    return { applied: false, reason: "ignored" };
  }
  if (input.event.kind === "order.paid") {
    await applyPaidOrder(db, input.environment, input.event.order);
    return { applied: true, reason: "order.paid" };
  }
  if (input.event.kind === "order.refunded") {
    await applyRefundedOrder(db, input.environment, input.event.order);
    return { applied: true, reason: "order.refunded" };
  }
  if (input.event.kind === "customer.upsert") {
    const workspaceId = await requireWorkspaceId(
      db,
      input.event.customer.externalId,
    );
    await upsertCustomer(
      db,
      input.environment,
      workspaceId,
      input.event.customer,
    );
    return { applied: true, reason: "customer.upsert" };
  }
  await applySubscriptionSnapshot(
    db,
    input.environment,
    input.event.subscription,
  );
  return { applied: true, reason: "subscription.snapshot" };
}

async function applyPaidOrder(
  db: DbOrTx,
  environment: BillingEnvironment,
  order: NormalizedOrder,
): Promise<void> {
  const workspaceId = await requireWorkspaceId(db, order.customer.externalId);
  await upsertCustomer(db, environment, workspaceId, order.customer);
  await upsertOrder(db, workspaceId, order);

  if (isTokenPackOffer(order.offerKey)) {
    await applyPurchaseAdjustment(db, workspaceId, order);
    return;
  }
  if (!isPlanOffer(order.offerKey)) return;

  await assignPolarPlan(db, workspaceId, order.offerKey);
  if (order.subscription) {
    await applySubscriptionSnapshot(db, environment, order.subscription);
  }
  if (shouldResetMonthlyAllowance(order.billingReason)) {
    await resetMonthlyForPolarPeriod(db, workspaceId, order.subscription);
  }
}

async function applyRefundedOrder(
  db: DbOrTx,
  environment: BillingEnvironment,
  order: NormalizedOrder,
): Promise<void> {
  const workspaceId = await requireWorkspaceId(db, order.customer.externalId);
  await upsertCustomer(db, environment, workspaceId, order.customer);
  await upsertOrder(db, workspaceId, order);
  if (!isTokenPackOffer(order.offerKey)) return;
  await applyRefundAdjustment(db, workspaceId, order);
}

async function applySubscriptionSnapshot(
  db: DbOrTx,
  environment: BillingEnvironment,
  subscription: NormalizedSubscription,
): Promise<void> {
  const workspaceId = await requireWorkspaceId(
    db,
    subscription.customer.externalId,
  );
  await upsertCustomer(db, environment, workspaceId, subscription.customer);

  const [existing] = await db
    .select()
    .from(billingSubscriptions)
    .where(
      eq(
        billingSubscriptions.providerSubscriptionId,
        subscription.providerSubscriptionId,
      ),
    )
    .limit(1);

  if (isStaleSubscription(existing, subscription.modifiedAt)) return;

  const now = new Date();
  const values = {
    workspaceId,
    providerProductId: subscription.providerProductId,
    offerKey: subscription.offerKey,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    endsAt: subscription.endsAt,
    endedAt: subscription.endedAt,
    providerModifiedAt: subscription.modifiedAt,
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(billingSubscriptions)
      .set(values)
      .where(eq(billingSubscriptions.id, existing.id));
  } else {
    await db.insert(billingSubscriptions).values({
      id: crypto.randomUUID(),
      providerSubscriptionId: subscription.providerSubscriptionId,
      createdAt: now,
      ...values,
    });
  }

  if (paidAccessEnded(subscription)) {
    const fallback = await getDefaultPlan(db);
    await assignWorkspacePlan(db, {
      workspaceId,
      planId: fallback.id,
      assignedBy: null,
      source: "polar",
    });
    return;
  }

  if (
    isLiveSubscriptionStatus(subscription.status) &&
    isPlanOffer(subscription.offerKey)
  ) {
    await assignPolarPlan(db, workspaceId, subscription.offerKey);
  }
}

function isStaleSubscription(
  existing: { providerModifiedAt: Date | null } | undefined,
  incoming: Date | null,
): boolean {
  if (!existing?.providerModifiedAt || !incoming) return false;
  return incoming.getTime() < existing.providerModifiedAt.getTime();
}

async function assignPolarPlan(
  db: DbOrTx,
  workspaceId: string,
  offerKey: BillingOfferKey,
): Promise<void> {
  const planKey = planKeyForOffer(offerKey);
  if (!planKey) return;
  const plan = await getPlanByKey(db, planKey);
  if (!plan) return;
  await assignWorkspacePlan(db, {
    workspaceId,
    planId: plan.id,
    assignedBy: null,
    source: "polar",
  });
}

async function resetMonthlyForPolarPeriod(
  db: DbOrTx,
  workspaceId: string,
  subscription: NormalizedSubscription | undefined,
): Promise<void> {
  const resolved = await getWorkspaceEntitlements(db, workspaceId);
  const [row] = await db
    .select()
    .from(aiTokenBalances)
    .where(eq(aiTokenBalances.workspaceId, workspaceId))
    .limit(1);
  if (!row) return;

  const limit =
    resolved?.entitlements.ai.monthlyIncludedTokens ?? row.monthlyLimit;
  const now = new Date();
  await db
    .update(aiTokenBalances)
    .set({
      monthlyRemaining: limit,
      monthlyLimit: limit,
      periodStart: subscription?.currentPeriodStart ?? now,
      periodEnd: subscription?.currentPeriodEnd ?? row.periodEnd,
      updatedAt: now,
    })
    .where(eq(aiTokenBalances.workspaceId, workspaceId));
}

async function applyPurchaseAdjustment(
  db: DbOrTx,
  workspaceId: string,
  order: NormalizedOrder,
): Promise<void> {
  const tokens = tokenPackAmount(order.offerKey);
  if (!tokens) return;
  await ensurePurchasedBalance(db, workspaceId);
  const inserted = await db
    .insert(billingTokenAdjustments)
    .values({
      id: crypto.randomUUID(),
      workspaceId,
      providerOrderId: order.providerOrderId,
      kind: "purchase",
      tokens,
      idempotencyKey: `polar:order:${order.providerOrderId}:purchase`,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) return;
  await db
    .update(aiTokenBalances)
    .set({
      purchasedRemaining: sql`${aiTokenBalances.purchasedRemaining} + ${tokens}`,
      updatedAt: new Date(),
    })
    .where(eq(aiTokenBalances.workspaceId, workspaceId));
}

async function applyRefundAdjustment(
  db: DbOrTx,
  workspaceId: string,
  order: NormalizedOrder,
): Promise<void> {
  const packTokens = tokenPackAmount(order.offerKey);
  if (!packTokens) return;
  await ensurePurchasedBalance(db, workspaceId);

  const [sumRow] = await db
    .select({
      reversed: sql<number>`coalesce(sum(case when ${billingTokenAdjustments.kind} = 'refund' then -${billingTokenAdjustments.tokens} else 0 end), 0)`,
    })
    .from(billingTokenAdjustments)
    .where(
      and(
        eq(billingTokenAdjustments.workspaceId, workspaceId),
        eq(billingTokenAdjustments.providerOrderId, order.providerOrderId),
      ),
    );

  const delta = refundedTokenDelta({
    packTokens,
    originalAmount: order.amount,
    newRefundedAmount: order.refundedAmount,
    alreadyReversed: Number(sumRow?.reversed ?? 0),
  });
  if (delta <= 0) return;

  const inserted = await db
    .insert(billingTokenAdjustments)
    .values({
      id: crypto.randomUUID(),
      workspaceId,
      providerOrderId: order.providerOrderId,
      kind: "refund",
      tokens: -delta,
      idempotencyKey: `polar:order:${order.providerOrderId}:refund:to:${Number(sumRow?.reversed ?? 0) + delta}`,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) return;

  await db
    .update(aiTokenBalances)
    .set({
      purchasedRemaining: sql`${aiTokenBalances.purchasedRemaining} - ${delta}`,
      updatedAt: new Date(),
    })
    .where(eq(aiTokenBalances.workspaceId, workspaceId));
}

async function upsertCustomer(
  db: DbOrTx,
  environment: BillingEnvironment,
  workspaceId: string,
  customer: NormalizedCustomer,
): Promise<void> {
  const now = new Date();
  await db
    .insert(billingCustomers)
    .values({
      workspaceId,
      environment,
      providerCustomerId: customer.providerCustomerId,
      providerExternalId: customer.externalId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: billingCustomers.workspaceId,
      set: {
        environment,
        providerCustomerId: customer.providerCustomerId,
        providerExternalId: customer.externalId,
        updatedAt: now,
      },
    });
}

async function upsertOrder(
  db: DbOrTx,
  workspaceId: string,
  order: NormalizedOrder,
): Promise<void> {
  const now = new Date();
  const values = {
    workspaceId,
    providerProductId: order.providerProductId,
    offerKey: order.offerKey,
    billingReason: order.billingReason,
    amount: order.amount,
    currency: order.currency,
    refundedAmount: order.refundedAmount,
    checkoutId: order.checkoutId,
    status: order.status,
    updatedAt: now,
  };
  await db
    .insert(billingOrders)
    .values({
      id: crypto.randomUUID(),
      providerOrderId: order.providerOrderId,
      createdAt: now,
      ...values,
    })
    .onConflictDoUpdate({
      target: billingOrders.providerOrderId,
      set: values,
    });
}

async function ensurePurchasedBalance(
  db: DbOrTx,
  workspaceId: string,
): Promise<void> {
  await db
    .insert(aiTokenBalances)
    .values(
      initialAiTokenBalanceValues(workspaceId, new Date(), {
        signupGiftedTokens: 0,
      }),
    )
    .onConflictDoNothing();
}

async function requireWorkspaceId(
  db: DbOrTx,
  externalId: string,
): Promise<string> {
  const [row] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, externalId))
    .limit(1);
  if (!row) throw new BillingWorkspaceNotFoundError(externalId);
  return row.id;
}

export type WorkspaceBillingState = {
  authority: "manual" | "polar";
  customer: typeof billingCustomers.$inferSelect | null;
  subscription: typeof billingSubscriptions.$inferSelect | null;
  pastDue: boolean;
  canceling: boolean;
};

export async function getWorkspaceBillingState(
  db: DbOrTx,
  workspaceId: string,
): Promise<WorkspaceBillingState> {
  const [workspace] = await db
    .select({ billingAuthority: workspaces.billingAuthority })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const [customer] = await db
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.workspaceId, workspaceId))
    .limit(1);

  const [subscription] = await db
    .select()
    .from(billingSubscriptions)
    .where(eq(billingSubscriptions.workspaceId, workspaceId))
    .orderBy(desc(billingSubscriptions.updatedAt))
    .limit(1);

  const authority = workspace?.billingAuthority ?? "manual";
  const liveSubscription =
    subscription &&
    isProjectedPolarSubscription({
      authority,
      status: subscription.status,
    })
      ? subscription
      : null;

  return {
    authority,
    customer: customer ?? null,
    subscription: liveSubscription,
    pastDue: liveSubscription
      ? showsPastDueBanner(liveSubscription.status)
      : false,
    canceling: liveSubscription
      ? showsCancelingBanner({
          status: liveSubscription.status,
          cancelAtPeriodEnd: liveSubscription.cancelAtPeriodEnd,
          endedAt: liveSubscription.endedAt,
        })
      : false,
  };
}

export async function workspaceHasLivePolarSubscription(
  db: DbOrTx,
  workspaceId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: billingSubscriptions.id })
    .from(billingSubscriptions)
    .innerJoin(workspaces, eq(workspaces.id, billingSubscriptions.workspaceId))
    .where(
      and(
        eq(billingSubscriptions.workspaceId, workspaceId),
        eq(workspaces.billingAuthority, "polar"),
        inArray(billingSubscriptions.status, [
          "active",
          "past_due",
          "canceled",
        ]),
        isNull(billingSubscriptions.endedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function listLivePolarWorkspaceIds(
  db: DbOrTx,
): Promise<Set<string>> {
  const rows = await db
    .select({ workspaceId: billingSubscriptions.workspaceId })
    .from(billingSubscriptions)
    .innerJoin(workspaces, eq(workspaces.id, billingSubscriptions.workspaceId))
    .where(
      and(
        eq(workspaces.billingAuthority, "polar"),
        inArray(billingSubscriptions.status, [
          "active",
          "past_due",
          "canceled",
        ]),
        isNull(billingSubscriptions.endedAt),
      ),
    );
  return new Set(rows.map((row) => row.workspaceId));
}
