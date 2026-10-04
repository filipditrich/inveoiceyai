import "server-only";
import { ForbiddenError } from "@/lib/auth/errors";
import { eq } from "drizzle-orm";

import { hasQuotaRoom, issuerBusinesses, member } from "@invoicey/db";
import { db } from "@invoicey/db/client";

import { loadEntitlements } from "./entitlements";

/**
 * Plan quotas, enforced on the **write path only** (ADR 0035).
 *
 * Assertions guard mutations; read helpers only inform the creation UI.
 * A workspace that exceeds its limits after a downgrade stays readable.
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

/** Read the current limit so creation screens can explain it before data entry. */
export async function getIssuerQuota(workspaceId: string) {
  const { entitlements } = await loadEntitlements(workspaceId);
  const limit = entitlements.issuers.max;
  if (limit === null) return { limit, canCreate: true };

  const rows = await db
    .select({ id: issuerBusinesses.id })
    .from(issuerBusinesses)
    .where(eq(issuerBusinesses.workspaceId, workspaceId));

  return { limit, canCreate: hasQuotaRoom(limit, rows.length) };
}

/** Rechecks the quota on submission, including forms opened before a plan change. */
export async function assertIssuerQuota(workspaceId: string): Promise<void> {
  const { limit, canCreate } = await getIssuerQuota(workspaceId);
  if (!canCreate && limit !== null) {
    throw new QuotaExceededError("issuers", limit);
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
