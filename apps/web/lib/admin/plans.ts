import "server-only";

import {
  EntitlementsSchema,
  assignWorkspacePlan,
  countWorkspacesByPlan,
  getPlanById,
  listPlans,
  resolveEntitlements,
  plans,
  type Entitlements,
  type PlanRow,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { eq } from "drizzle-orm";

import { recordSecurityAuditEvent } from "@/lib/auth/security-audit";
import type { AdminMutationResult } from "@/lib/admin/mutations";

export interface AdminPlanListItem {
  id: string;
  key: string;
  name: string;
  kind: "builtin" | "custom";
  isDefault: boolean;
  archivedAt: Date | null;
  autoAssignEmailDomains: string[];
  entitlements: Entitlements;
  /** The number that makes an edit consequential. */
  workspaceCount: number;
}

export async function adminListPlans(): Promise<AdminPlanListItem[]> {
  const [rows, counts] = await Promise.all([
    listPlans(db, { includeArchived: true }),
    countWorkspacesByPlan(db),
  ]);

  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    kind: row.kind,
    isDefault: row.isDefault,
    archivedAt: row.archivedAt,
    autoAssignEmailDomains: row.autoAssignEmailDomains,
    // Parsed rather than cast: a row hand-edited into an invalid shape should
    // surface here, on the page whose job is to fix it.
    entitlements: EntitlementsSchema.parse(row.entitlements),
    workspaceCount: counts.get(row.id) ?? 0,
  }));
}

export async function adminGetPlan(
  id: string,
): Promise<AdminPlanListItem | null> {
  const all = await adminListPlans();
  return all.find((plan) => plan.id === id) ?? null;
}

/** Plans offered in the workspace assignment picker — archived ones excluded. */
export async function adminSelectablePlans(): Promise<PlanRow[]> {
  return listPlans(db);
}

/**
 * Moves a workspace onto a plan.
 *
 * Non-destructive by design: nothing is removed when the new plan is smaller,
 * because quotas are enforced on the write path only. An over-limit workspace
 * stays fully readable and simply cannot grow (ADR 0035).
 */
export async function adminAssignPlan(input: {
  actorUserId: string;
  workspaceId: string;
  planId: string;
}): Promise<AdminMutationResult> {
  const plan = await getPlanById(db, input.planId);
  if (!plan) {
    return { ok: false, error: "not_found" };
  }

  try {
    await assignWorkspacePlan(db, {
      workspaceId: input.workspaceId,
      planId: plan.id,
      assignedBy: input.actorUserId,
    });
  } catch (error) {
    console.error("[admin] plan assignment failed", error);
    return { ok: false, error: "failed" };
  }

  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    workspaceId: input.workspaceId,
    type: "platform_plan_assign",
    metadata: { planId: plan.id, planKey: plan.key },
  });

  return { ok: true };
}

/**
 * Replaces a plan's entitlements wholesale.
 *
 * Every workspace on the plan moves at once — that is the point of the table —
 * so the caller is expected to have shown the workspace count first.
 */
export async function adminUpdatePlanEntitlements(input: {
  actorUserId: string;
  planId: string;
  entitlements: unknown;
  autoAssignEmailDomains: string[];
}): Promise<AdminMutationResult> {
  const plan = await getPlanById(db, input.planId);
  if (!plan) {
    return { ok: false, error: "not_found" };
  }

  const parsed = EntitlementsSchema.safeParse(input.entitlements);
  if (!parsed.success) {
    return { ok: false, error: "invalid_amount" };
  }

  try {
    await db
      .update(plans)
      .set({
        entitlements: parsed.data,
        autoAssignEmailDomains: input.autoAssignEmailDomains,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, plan.id));
  } catch (error) {
    console.error("[admin] plan update failed", error);
    return { ok: false, error: "failed" };
  }

  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    type: "platform_plan_update",
    metadata: { planId: plan.id, planKey: plan.key },
  });

  return { ok: true };
}

export { resolveEntitlements };
