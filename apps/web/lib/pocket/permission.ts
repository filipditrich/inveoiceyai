import "server-only";
import {
  PERMISSION_ENTITLEMENT,
  resolvePermissions,
  type Permission,
  type PermissionOverrides,
} from "@/lib/authz/catalog";
import { and, eq } from "drizzle-orm";

import {
  getWorkspaceEntitlements,
  member,
  readBooleanEntitlement,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

export async function pocketDeviceCan(input: {
  userId: string;
  workspaceId: string;
  permission: Permission;
}): Promise<boolean> {
  const [memberships, resolved] = await Promise.all([
    db
      .select({ role: member.role, overrides: member.permissionOverrides })
      .from(member)
      .where(
        and(
          eq(member.userId, input.userId),
          eq(member.organizationId, input.workspaceId),
        ),
      )
      .limit(1),
    getWorkspaceEntitlements(db, input.workspaceId),
  ]);
  const membership = memberships[0];
  if (!membership || !resolved) return false;
  const required = PERMISSION_ENTITLEMENT[input.permission];
  if (required && !readBooleanEntitlement(resolved.entitlements, required)) {
    return false;
  }
  let overrides: PermissionOverrides | null = null;
  if (resolved.entitlements.permissions.mode === "advanced") {
    // SAFETY: the schema stores this documented grant/deny shape and the
    // resolver ignores any stale permission strings it does not recognize.
    overrides = (membership.overrides as PermissionOverrides | null) ?? null;
  }
  return resolvePermissions(membership.role, overrides).has(input.permission);
}
