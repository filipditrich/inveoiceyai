import "server-only";

import { member } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import { cache } from "react";

import { ForbiddenError } from "@/lib/auth/errors";
import { requireWorkspace } from "@/lib/auth/session";
import { loadEntitlements } from "@/lib/entitlements/entitlements";
import { readBooleanEntitlement } from "@invoicey/db";
import {
  PERMISSION_ENTITLEMENT,
  resolvePermissions,
  type Permission,
  type PermissionOverrides,
} from "./catalog";

/**
 * The authorization chokepoint (ADR 0038).
 *
 * Three steps, in order:
 *   1. the entitlement the permission depends on — a Free workspace has no
 *      payments layer, so no role inside it can reach one;
 *   2. the role preset;
 *   3. per-member overrides, where deny beats grant.
 *
 * Call this in every mutation surface: server actions, route handlers, MCP
 * tools, Eve/Slack tools, cron. Hiding UI is in addition to this, never instead
 * of it — the Slack agent reaches the same database as the web form.
 */

/** Effective permissions for the caller in their active workspace. */
export const loadPermissions = cache(async (): Promise<Set<Permission>> => {
  const { workspaceId, userId, role } = await requireWorkspace();

  const [row] = await db
    .select({ overrides: member.permissionOverrides })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, workspaceId)),
    )
    .limit(1);

  const { entitlements } = await loadEntitlements(workspaceId);

  // Per-member overrides are a paid capability. Reading them on a plan that
  // does not include them would let a downgrade silently keep enforcing rules
  // the workspace can no longer see or edit.
  const overrides: PermissionOverrides | null =
    entitlements.permissions.mode === "advanced"
      ? ((row?.overrides as PermissionOverrides | null) ?? null)
      : null;

  const granted = resolvePermissions(role, overrides);

  // Strip anything the plan does not include, so a preset written for Pro
  // degrades cleanly on Free instead of granting a feature that is switched off.
  for (const permission of granted) {
    const required = PERMISSION_ENTITLEMENT[permission];
    if (required && !readBooleanEntitlement(entitlements, required)) {
      granted.delete(permission);
    }
  }

  return granted;
});

/** Non-throwing check, for deciding whether to render something. */
export async function can(permission: Permission): Promise<boolean> {
  return (await loadPermissions()).has(permission);
}

/** Throwing gate. Use at the top of the mutation, before validating input. */
export async function assertCan(permission: Permission): Promise<void> {
  if (!(await can(permission))) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
}
