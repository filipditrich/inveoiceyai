import "server-only";

import { user as userTable, type PlatformRole } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";
import { eq } from "drizzle-orm";

import { parsePlatformAdminEmails } from "./platform-admin-emails";

export { parsePlatformAdminEmails } from "./platform-admin-emails";

export function platformAdminEmailAllowlist(): Set<string> {
  return parsePlatformAdminEmails(env.INVOICEY_PLATFORM_ADMIN_EMAILS);
}

/**
 * Promote allowlisted emails to platform admin. Never demotes.
 * Safe to call from session hooks; swallows errors so auth still succeeds.
 */
export async function maybePromotePlatformAdminFromAllowlist(
  userId: string,
): Promise<void> {
  try {
    const allowlist = platformAdminEmailAllowlist();
    if (allowlist.size === 0) return;

    const [row] = await db
      .select({
        email: userTable.email,
        platformRole: userTable.platformRole,
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (!row) return;
    if (row.platformRole === "admin") return;
    if (!allowlist.has(row.email.trim().toLowerCase())) return;

    await db
      .update(userTable)
      .set({ platformRole: "admin", updatedAt: new Date() })
      .where(eq(userTable.id, userId));
  } catch (err) {
    console.error("[invoicey] platform admin allowlist promote failed", err);
  }
}

export async function loadPlatformRole(userId: string): Promise<PlatformRole> {
  const [row] = await db
    .select({ platformRole: userTable.platformRole })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return row?.platformRole === "admin" ? "admin" : "none";
}
