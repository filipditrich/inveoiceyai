import "server-only";
import {
  PERMISSION_ENTITLEMENT,
  resolvePermissions,
  type PermissionOverrides,
} from "@/lib/authz/catalog";
import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";

import {
  member,
  getWorkspaceEntitlements,
  readBooleanEntitlement,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

export async function mcpMembership(userId: string, workspaceId: string) {
  const [membership] = await db
    .select()
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, workspaceId)),
    )
    .limit(1);
  if (!membership) return null;
  const workspace = await getWorkspaceEntitlements(db, workspaceId);
  if (!workspace) return null;
  // SAFETY: persisted overrides use the permission catalog shape shared with the web authorization gate.
  const overrides =
    workspace.entitlements.permissions.mode === "advanced"
      ? (membership.permissionOverrides as PermissionOverrides | null)
      : null;
  const permissions = resolvePermissions(membership.role, overrides);
  for (const permission of permissions) {
    const entitlement = PERMISSION_ENTITLEMENT[permission];
    if (
      entitlement &&
      !readBooleanEntitlement(workspace.entitlements, entitlement)
    )
      permissions.delete(permission);
  }
  return { userId, workspaceId, permissions };
}
export async function requireMcpWorkspace(userId: string, workspaceId: string) {
  if (!(await mcpMembership(userId, workspaceId)))
    throw new APIError("FORBIDDEN", {
      message: "Workspace membership required",
    });
  return workspaceId;
}
