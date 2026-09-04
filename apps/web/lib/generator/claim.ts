import "server-only";
import { applyWorkspacePlanBootstrap } from "@/lib/auth/workspace-plan-bootstrap";
import {
  randomSlugSuffix,
  slugifyWorkspaceName,
} from "@/lib/auth/workspace-slug";
import { and, eq } from "drizzle-orm";

import {
  claimGuestWorkspace,
  findUnclaimedGuestWorkspaces,
  member,
  user as userTable,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

export type ClaimUser = {
  id: string;
  name?: string | null;
  email: string;
  emailVerified?: boolean;
};

export type ClaimOutcome =
  | { ok: true; workspaceId: string; alreadyClaimed: boolean }
  | { ok: false; reason: "not_found" | "already_claimed" | "unavailable" };

function workspaceNameFor(user: ClaimUser): string {
  return user.name?.trim() || user.email.split("@")[0] || "Workspace";
}

function slugBaseFor(user: ClaimUser): string {
  return slugifyWorkspaceName(user.email.split("@")[0] || user.name || "");
}

/**
 * Ownership change for one guest workspace, plus the Free-plan bootstrap
 * guest creation skipped (ADR 0048 §4, §7).
 */
export async function claimGuestWorkspaceForUser(input: {
  workspaceId: string;
  user: ClaimUser;
}): Promise<ClaimOutcome> {
  const name = workspaceNameFor(input.user);
  let slug = slugBaseFor(input.user);

  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const result = await claimGuestWorkspace(db, {
          workspaceId: input.workspaceId,
          userId: input.user.id,
          name,
          slug,
        });
        if (!result.ok) {
          if (result.reason === "already_claimed") {
            return alreadyClaimedByThisUser(input);
          }
          return { ok: false, reason: result.reason };
        }
        await applyWorkspacePlanBootstrap({
          workspaceId: input.workspaceId,
          owner: {
            email: input.user.email,
            emailVerified: input.user.emailVerified,
          },
        });
        return {
          ok: true,
          workspaceId: input.workspaceId,
          alreadyClaimed: false,
        };
      } catch (error) {
        if (attempt >= 4 || !isUniqueViolation(error)) throw error;
        slug = `${slugBaseFor(input.user)}-${randomSlugSuffix()}`;
      }
    }
  } catch (error) {
    console.error("[invoicey] claimGuestWorkspaceForUser failed", error);
    return { ok: false, reason: "unavailable" };
  }
}

async function alreadyClaimedByThisUser(input: {
  workspaceId: string;
  user: ClaimUser;
}): Promise<ClaimOutcome> {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.userId, input.user.id),
        eq(member.organizationId, input.workspaceId),
      ),
    )
    .limit(1);
  if (row) {
    return { ok: true, workspaceId: input.workspaceId, alreadyClaimed: true };
  }
  return { ok: false, reason: "already_claimed" };
}

/**
 * Every unclaimed guest workspace whose address equals this verified OAuth
 * address. Newest first; claiming does not merge workspaces.
 */
export async function autoClaimGuestWorkspacesByEmail(
  user: ClaimUser,
): Promise<string[]> {
  const guests = await findUnclaimedGuestWorkspaces(db, { email: user.email });
  const claimed: string[] = [];
  for (const guest of guests) {
    const result = await claimGuestWorkspaceForUser({
      workspaceId: guest.id,
      user,
    });
    if (result.ok) claimed.push(result.workspaceId);
  }
  return claimed;
}

export async function setDefaultWorkspaceIfMissing(
  userId: string,
  workspaceId: string,
): Promise<void> {
  const [row] = await db
    .select({ defaultWorkspaceId: userTable.defaultWorkspaceId })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (row?.defaultWorkspaceId) return;
  await db
    .update(userTable)
    .set({ defaultWorkspaceId: workspaceId })
    .where(eq(userTable.id, userId));
}
