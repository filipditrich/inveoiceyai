import "server-only";
import { cache } from "react";
import { ForbiddenError } from "@/lib/auth/errors";
import { requireWorkspace } from "@/lib/auth/session";

import {
  getWorkspaceEntitlements,
  hasQuotaRoom,
  readBooleanEntitlement,
  type BooleanEntitlementPath,
  type Entitlements,
  type WorkspaceEntitlements,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

export type { BooleanEntitlementPath, Entitlements, WorkspaceEntitlements };

/**
 * Resolved entitlements for the caller's active workspace (ADR 0035).
 *
 * Memoised per request the same way `requireWorkspace()` is, so a layout, a
 * page, and three server components can each ask without a second round trip.
 */
export const requireEntitlements = cache(
  async (): Promise<WorkspaceEntitlements> => {
    const { workspaceId } = await requireWorkspace();
    return loadEntitlements(workspaceId);
  },
);

/** Entitlements for an explicitly supplied workspace — agent and cron paths. */
export const loadEntitlements = cache(
  async (workspaceId: string): Promise<WorkspaceEntitlements> => {
    const resolved = await getWorkspaceEntitlements(db, workspaceId);
    if (!resolved) {
      // `plan_id` is NOT NULL and the FK is RESTRICT, so this means the
      // workspace itself is gone underneath a live session.
      throw new ForbiddenError("Workspace not found");
    }
    return resolved;
  },
);

/**
 * Capability gate. Call this in the server action, route handler, or agent tool
 * — hiding the UI is in addition to this, never instead of it.
 */
export async function requireEntitlement(
  path: BooleanEntitlementPath,
): Promise<Entitlements> {
  const { entitlements } = await requireEntitlements();
  if (!readBooleanEntitlement(entitlements, path)) {
    throw new ForbiddenError(`Plan does not include ${path}`);
  }
  return entitlements;
}

/** Non-throwing variant, for deciding whether to render an upsell. */
export async function hasEntitlement(
  path: BooleanEntitlementPath,
): Promise<boolean> {
  const { entitlements } = await requireEntitlements();
  return readBooleanEntitlement(entitlements, path);
}

export { hasQuotaRoom };
