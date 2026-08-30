import "server-only";

import { getWorkspaceEntitlements, member } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { eq } from "drizzle-orm";

/**
 * Seat and domain policy for workspace invitations (ADR 0035, ADR 0038).
 *
 * Invitations go through Better Auth's organization endpoints, not through our
 * server actions, so `assertCan` never sees them. This runs as a `before` hook
 * on that endpoint instead — otherwise seat limits would be enforced only by
 * the UI, which is no enforcement at all.
 */

export type InvitePolicyResult =
  | { ok: true }
  | { ok: false; code: "seats_full" | "domain_not_allowed"; message: string };

export async function checkInvitePolicy(input: {
  workspaceId: string;
  email: string;
}): Promise<InvitePolicyResult> {
  const resolved = await getWorkspaceEntitlements(db, input.workspaceId);
  if (!resolved) return { ok: true };

  const { entitlements } = resolved;

  const allowed = entitlements.auth.allowedEmailDomains;
  if (allowed.length > 0) {
    const domain = input.email.split("@").pop()?.trim().toLowerCase() ?? "";
    if (!allowed.includes(domain)) {
      return {
        ok: false,
        code: "domain_not_allowed",
        message: `This workspace only admits ${allowed.join(", ")} addresses`,
      };
    }
  }

  const max = entitlements.seats.max;
  if (max !== null) {
    // Counted on the write path only. An over-limit workspace (after a
    // downgrade) stays fully readable and simply cannot grow (ADR 0035).
    const rows = await db
      .select({ id: member.id })
      .from(member)
      .where(eq(member.organizationId, input.workspaceId));

    // Pending invitations are deliberately not counted: an invite that is
    // never accepted would otherwise permanently consume a seat.
    if (rows.length >= max) {
      return {
        ok: false,
        code: "seats_full",
        message: `This plan includes ${max} seat${max === 1 ? "" : "s"}`,
      };
    }
  }

  return { ok: true };
}
