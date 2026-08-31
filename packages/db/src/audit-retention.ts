import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";

import type { InvoiceyDb } from "./create-db";
import { resolveEntitlements } from "./entitlements";
import { plans } from "./plans";
import { securityAuditEvents } from "./security-schema";
import { workspaces } from "./workspaces";

export interface AuditRetentionResult {
  /** Workspaces whose plan sets a finite retention. */
  scanned: number;
  deleted: number;
}

/**
 * Deletes security-audit events past each workspace's plan retention
 * (ADR 0035).
 *
 * Grouped by plan rather than iterated per workspace: retention is a plan
 * property, so one DELETE per distinct cutoff covers every workspace on it.
 * `null` retention means keep forever and is skipped entirely — never
 * translated into a very large number, which would silently start deleting on
 * an Enterprise workspace the day someone changed the constant.
 *
 * Events with no `workspace_id` (account-scoped: sign-ins, device trust) are
 * never touched here. They belong to a user, not a workspace, so no workspace's
 * plan governs them.
 */
export async function pruneAuditEvents(
  db: InvoiceyDb,
  now = new Date(),
): Promise<AuditRetentionResult> {
  const rows = await db
    .select({
      planId: plans.id,
      entitlements: plans.entitlements,
      overrides: workspaces.entitlementOverrides,
      workspaceId: workspaces.id,
    })
    .from(workspaces)
    .innerJoin(plans, eq(plans.id, workspaces.planId));

  // Bucket workspaces by their resolved retention, so a plan-wide policy is one
  // statement and a workspace with an override still gets its own.
  const byCutoff = new Map<number, string[]>();
  for (const row of rows) {
    const days = resolveEntitlements(row.entitlements, row.overrides).audit
      .retentionDays;
    if (days === null) continue;
    byCutoff.set(days, [...(byCutoff.get(days) ?? []), row.workspaceId]);
  }

  let deleted = 0;
  let scanned = 0;

  for (const [days, workspaceIds] of byCutoff) {
    scanned += workspaceIds.length;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const removed = await db
      .delete(securityAuditEvents)
      .where(
        and(
          isNotNull(securityAuditEvents.workspaceId),
          // `inArray`, not a raw `= ANY(...)`: drizzle expands a JS array into
          // a row expression `($1, $2, ...)`, which ANY rejects outright.
          inArray(securityAuditEvents.workspaceId, workspaceIds),
          lt(securityAuditEvents.createdAt, cutoff),
        ),
      )
      .returning({ id: securityAuditEvents.id });

    deleted += removed.length;
  }

  return { scanned, deleted };
}
