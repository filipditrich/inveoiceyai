import "server-only";

import { user as userTable, type PlatformRole } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { eq } from "drizzle-orm";

import { recordSecurityAuditEvent } from "@/lib/auth/security-audit";

/** Grant/revoke platform role; refuses to demote the last admin. */
export async function adminSetPlatformRole(input: {
  actorUserId: string;
  targetUserId: string;
  role: PlatformRole;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const next = input.role === "admin" ? "admin" : "none";

  const [target] = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      platformRole: userTable.platformRole,
    })
    .from(userTable)
    .where(eq(userTable.id, input.targetUserId))
    .limit(1);

  if (!target) {
    return { ok: false, error: "User not found" };
  }

  const current = target.platformRole === "admin" ? "admin" : "none";
  if (current === next) {
    return { ok: true };
  }

  if (next === "none") {
    const admins = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.platformRole, "admin"));
    if (admins.length <= 1 && current === "admin") {
      return { ok: false, error: "Cannot revoke the last platform admin" };
    }
  }

  await db
    .update(userTable)
    .set({ platformRole: next, updatedAt: new Date() })
    .where(eq(userTable.id, target.id));

  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    type: next === "admin" ? "platform_admin_grant" : "platform_admin_revoke",
    metadata: {
      targetUserId: target.id,
      targetEmail: target.email,
      role: next,
    },
  });

  return { ok: true };
}
