import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { aiTokenBalances } from "./ai-usage";
import type { InvoiceyDb } from "./create-db";
import {
  resolveEntitlements,
  type Entitlements,
  type EntitlementOverrides,
} from "./entitlements";
import { DEFAULT_PLAN_KEY } from "./plan-presets";
import { plans, type PlanRow } from "./plans";
import type { DbTransaction } from "./transaction";
import { workspaces } from "./workspaces";

type DbOrTx = InvoiceyDb | DbTransaction;

export class PlanNotFoundError extends Error {
  readonly code = "plan_not_found" as const;
  constructor(identifier: string) {
    super(`No plan for ${identifier}`);
    this.name = "PlanNotFoundError";
  }
}

export class PolarPlanLockedError extends Error {
  readonly code = "polar_plan_locked" as const;
  constructor(workspaceId: string) {
    super(`Workspace ${workspaceId} is under Polar plan authority`);
    this.name = "PolarPlanLockedError";
  }
}

/** A workspace's plan and the entitlements that actually apply to it. */
export interface WorkspaceEntitlements {
  workspaceId: string;
  planId: string;
  planKey: string;
  planName: string;
  planKind: "builtin" | "custom";
  /** Plan defaults with the workspace's overrides merged in. */
  entitlements: Entitlements;
  /** Present only when the workspace deviates from its plan. */
  overrides: EntitlementOverrides | null;
  assignedAt: Date;
  assignedBy: string | null;
  billingAuthority: "manual" | "polar";
}

/** Normalizes `Foo@NFCtron.COM` / `nfctron.com` to `nfctron.com`. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  const domain = (at === -1 ? email : email.slice(at + 1)).trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

export async function listPlans(
  db: DbOrTx,
  options: { includeArchived?: boolean } = {},
): Promise<PlanRow[]> {
  const rows = await db
    .select()
    .from(plans)
    .where(options.includeArchived ? undefined : isNull(plans.archivedAt))
    .orderBy(asc(plans.kind), asc(plans.createdAt));
  return rows;
}

export async function getPlanByKey(
  db: DbOrTx,
  key: string,
): Promise<PlanRow | null> {
  const [row] = await db
    .select()
    .from(plans)
    .where(eq(plans.key, key))
    .limit(1);
  return row ?? null;
}

export async function getPlanById(
  db: DbOrTx,
  id: string,
): Promise<PlanRow | null> {
  const [row] = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
  return row ?? null;
}

/**
 * The plan a workspace created by this user should land on: the first
 * non-archived plan claiming their email domain, else the default plan.
 *
 * The rule keys off the **person**, and callers apply it on every workspace
 * they create rather than only the first. Keying off the workspace instead
 * leaves the obvious escape hatch — create a second workspace, get an
 * unrestricted account.
 *
 * Only verified addresses match. An unverified one is an unproven claim to a
 * domain, and this rule hands out entitlements.
 */
export async function resolvePlanForNewWorkspace(
  db: DbOrTx,
  owner: { email?: string | null; emailVerified?: boolean },
): Promise<PlanRow> {
  const domain =
    owner.emailVerified && owner.email ? emailDomain(owner.email) : null;

  if (domain) {
    const [matched] = await db
      .select()
      .from(plans)
      .where(
        and(
          isNull(plans.archivedAt),
          sql`${domain} = ANY(${plans.autoAssignEmailDomains})`,
        ),
      )
      // Ties break to the most recently touched custom plan: a bespoke row was
      // written for a reason, a builtin one is a fallback.
      .orderBy(
        sql`case when ${plans.kind} = 'custom' then 0 else 1 end`,
        desc(plans.updatedAt),
      )
      .limit(1);
    if (matched) return matched;
  }

  return getDefaultPlan(db);
}

export async function getDefaultPlan(db: DbOrTx): Promise<PlanRow> {
  const [row] = await db
    .select()
    .from(plans)
    .where(eq(plans.isDefault, true))
    .limit(1);
  if (row) return row;

  // The partial unique index guarantees at most one default, not at least one.
  // Fall back to the seeded key so a mis-seeded database degrades to Free
  // rather than refusing to create workspaces.
  const fallback = await getPlanByKey(db, DEFAULT_PLAN_KEY);
  if (!fallback) throw new PlanNotFoundError("default");
  return fallback;
}

/**
 * Resolved entitlements for one workspace. Returns `null` when the workspace
 * does not exist; callers that already hold a `WorkspaceContext` can treat that
 * as impossible.
 */
export async function getWorkspaceEntitlements(
  db: DbOrTx,
  workspaceId: string,
): Promise<WorkspaceEntitlements | null> {
  const [row] = await db
    .select({
      workspaceId: workspaces.id,
      overrides: workspaces.entitlementOverrides,
      assignedAt: workspaces.planAssignedAt,
      assignedBy: workspaces.planAssignedBy,
      billingAuthority: workspaces.billingAuthority,
      planId: plans.id,
      planKey: plans.key,
      planName: plans.name,
      planKind: plans.kind,
      planEntitlements: plans.entitlements,
    })
    .from(workspaces)
    .innerJoin(plans, eq(plans.id, workspaces.planId))
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!row) return null;

  return {
    workspaceId: row.workspaceId,
    planId: row.planId,
    planKey: row.planKey,
    planName: row.planName,
    planKind: row.planKind,
    entitlements: resolveEntitlements(row.planEntitlements, row.overrides),
    overrides: row.overrides ?? null,
    assignedAt: row.assignedAt,
    assignedBy: row.assignedBy,
    billingAuthority: row.billingAuthority,
  };
}

export interface AssignPlanInput {
  workspaceId: string;
  planId: string;
  /** Platform admin making the change; null for the automatic domain rule. */
  assignedBy: string | null;
  /** Replaces the existing overrides wholesale. Omit to leave them untouched. */
  overrides?: EntitlementOverrides | null;
  /** Polar fulfillment may change a Polar-managed plan; admin may not. */
  source?: "admin" | "automatic" | "polar";
  /** Platform-admin takeover after any live Polar subscription is gone. */
  detachPolar?: boolean;
}

/**
 * Moves a workspace onto a plan and re-seeds its monthly AI allowance.
 *
 * Deliberately non-destructive in both directions. A downgrade does not remove
 * members, issuers, or clients that now exceed the new limits — quotas are
 * enforced on the write path only, so an over-limit workspace stays fully
 * readable and simply cannot grow. Anything else would make every plan change a
 * data-loss event, and nobody would dare touch one.
 *
 * The monthly *limit* moves immediately; the current period's remaining balance
 * does not, so an upgrade mid-period does not hand out a second allowance and a
 * downgrade does not claw back tokens already granted.
 */
export async function assignWorkspacePlan(
  db: DbOrTx,
  input: AssignPlanInput,
): Promise<WorkspaceEntitlements> {
  const plan = await getPlanById(db, input.planId);
  if (!plan) throw new PlanNotFoundError(input.planId);

  const [current] = await db
    .select({ billingAuthority: workspaces.billingAuthority })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);
  if (!current) throw new PlanNotFoundError(input.workspaceId);

  if (
    current.billingAuthority === "polar" &&
    input.source !== "polar" &&
    !input.detachPolar
  ) {
    throw new PolarPlanLockedError(input.workspaceId);
  }

  await db
    .update(workspaces)
    .set({
      planId: plan.id,
      planAssignedAt: new Date(),
      planAssignedBy: input.assignedBy,
      ...(input.overrides === undefined
        ? {}
        : { entitlementOverrides: input.overrides }),
      ...(input.source === "polar" ? { billingAuthority: "polar" } : {}),
      ...(input.detachPolar ? { billingAuthority: "manual" } : {}),
    })
    .where(eq(workspaces.id, input.workspaceId));

  const resolved = await getWorkspaceEntitlements(db, input.workspaceId);
  if (!resolved) throw new PlanNotFoundError(input.workspaceId);

  await db
    .update(aiTokenBalances)
    .set({ monthlyLimit: resolved.entitlements.ai.monthlyIncludedTokens })
    .where(eq(aiTokenBalances.workspaceId, input.workspaceId));

  return resolved;
}

/** How many workspaces sit on each plan — the number that makes an edit scary. */
export async function countWorkspacesByPlan(
  db: DbOrTx,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ planId: workspaces.planId, count: sql<number>`count(*)::int` })
    .from(workspaces)
    .groupBy(workspaces.planId);
  return new Map(rows.map((row) => [row.planId, row.count]));
}
