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

/** Prune workspace logs by plan and all security logs at the 365-day ceiling. */
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

  // Includes account-scoped events and workspaces without a matching plan.
  const expired = await db
    .delete(securityAuditEvents)
    .where(
      lt(
        securityAuditEvents.createdAt,
        new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      ),
    )
    .returning({ id: securityAuditEvents.id });
  let deleted = expired.length;
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
