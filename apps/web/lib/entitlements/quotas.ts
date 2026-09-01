import "server-only";
import { ForbiddenError } from "@/lib/auth/errors";
import { eq } from "drizzle-orm";

import { hasQuotaRoom, issuerBusinesses, member } from "@invoicey/db";
import { db } from "@invoicey/db/client";

import { loadEntitlements } from "./entitlements";

/**
 * Plan quotas, enforced on the **write path only** (ADR 0035).
 *
 * Never called on a read. A workspace that exceeds its limits after a downgrade
 * stays fully readable and simply cannot grow — anything else would make every
 * plan change a data-loss event, and nobody would dare touch one.
 */

export class QuotaExceededError extends ForbiddenError {
  constructor(
    readonly quota: "seats" | "issuers",
    readonly limit: number,
  ) {
    super(`Plan allows ${limit} ${quota}`);
    this.name = "QuotaExceededError";
  }
}

/** Blocks creating an issuer beyond the plan's ceiling. */
export async function assertIssuerQuota(workspaceId: string): Promise<void> {
  const { entitlements } = await loadEntitlements(workspaceId);
  const max = entitlements.issuers.max;
  if (max === null) return;

  const rows = await db
    .select({ id: issuerBusinesses.id })
    .from(issuerBusinesses)
    .where(eq(issuerBusinesses.workspaceId, workspaceId));

  if (!hasQuotaRoom(max, rows.length)) {
    throw new QuotaExceededError("issuers", max);
  }
}

/**
 * Blocks adding a member beyond the plan's ceiling.
 *
 * The invite path has its own check in the Better Auth hook, since invitations
 * never reach our server actions. This covers anything that adds a membership
 * directly.
 */
export async function assertSeatQuota(workspaceId: string): Promise<void> {
  const { entitlements } = await loadEntitlements(workspaceId);
  const max = entitlements.seats.max;
  if (max === null) return;

  const rows = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.organizationId, workspaceId));

  if (!hasQuotaRoom(max, rows.length)) {
    throw new QuotaExceededError("seats", max);
  }
}
