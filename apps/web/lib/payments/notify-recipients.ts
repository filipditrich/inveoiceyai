import "server-only";
import {
  PERMISSION_ENTITLEMENT,
  resolvePermissions,
  type Permission,
  type PermissionOverrides,
} from "@/lib/authz/catalog";
import { eq } from "drizzle-orm";

import {
  getWorkspaceEntitlements,
  member,
  readBooleanEntitlement,
  user,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

export type PaymentNotificationRecipient = {
  userId: string;
  name: string;
  email: string;
};

/**
 * Who to tell about payment events, resolved without a session.
 *
 * `loadPermissions` in `authz/can` is the request-time chokepoint and starts
 * from `requireWorkspace()`, so cron has no way to call it. This walks the same
 * three steps in the same order — entitlement, role preset, member overrides —
 * against an explicit workspace instead. Keeping the order identical is the
 * point: a member who cannot open `/payments` must never be emailed about what
 * is on it.
 *
 * Entitlements come from `getWorkspaceEntitlements` rather than the app's
 * `loadEntitlements`, which is a request-scoped `React.cache` wrapper that
 * throws `ForbiddenError` — neither behaviour belongs in a cron sweep.
 */
export async function listPaymentNotificationRecipients(input: {
  workspaceId: string;
  permission: Permission;
}): Promise<PaymentNotificationRecipient[]> {
  const resolved = await getWorkspaceEntitlements(db, input.workspaceId);
  if (!resolved) return [];
  const { entitlements } = resolved;
  const required = PERMISSION_ENTITLEMENT[input.permission];
  if (required && !readBooleanEntitlement(entitlements, required)) return [];
  const advancedPermissions = entitlements.permissions.mode === "advanced";

  const rows = await db
    .select({
      userId: member.userId,
      role: member.role,
      overrides: member.permissionOverrides,
      name: user.name,
      email: user.email,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, input.workspaceId));

  const recipients: PaymentNotificationRecipient[] = [];
  for (const row of rows) {
    if (!row.email) continue;
    // SAFETY: `permission_overrides` is a jsonb column typed as loose
    // `{ grant?: string[]; deny?: string[] }` at the schema. `resolvePermissions`
    // only ever reads those two arrays and ignores entries it does not know,
    // so a stale or partial value degrades to the role preset.
    const overrides: PermissionOverrides | null = advancedPermissions
      ? ((row.overrides as PermissionOverrides | null) ?? null)
      : null;
    if (!resolvePermissions(row.role, overrides).has(input.permission)) {
      continue;
    }
    recipients.push({
      userId: row.userId,
      name: row.name ?? "",
      email: row.email,
    });
  }
  return recipients;
}
