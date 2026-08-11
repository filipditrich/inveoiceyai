import "server-only";

import { member, user as userTable, workspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { asc, eq } from "drizzle-orm";

/** Shape Better Auth hands to the `user.create.after` hook. */
interface CreatedUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

/** Email local-part, else the name: `ditrich@…` -> `ditrich`. Strips diacritics. */
function slugBase(user: CreatedUser): string {
  const source = user.email?.split("@")[0] ?? user.name ?? "workspace";
  const slug = source
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug.slice(0, 40) : "workspace";
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Creates the user's personal workspace and owner membership on first sign-in,
 * then records it as their default (used by machine identities that have no
 * active-org cookie).
 *
 * Inserts directly rather than calling `auth.api.createOrganization` — this runs
 * inside a Better Auth hook, where re-entering the API risks recursion.
 */
export async function createPersonalWorkspace(
  user: CreatedUser,
): Promise<string> {
  const workspaceId = crypto.randomUUID();
  const name = user.name ? `${user.name}'s workspace` : "Personal workspace";

  // Retry on the unique slug index rather than pre-checking (racy under
  // concurrent first sign-ins).
  const base = slugBase(user);
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await db.insert(workspaces).values({ id: workspaceId, name, slug });
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      slug = `${base}-${randomSuffix()}`;
    }
  }

  await db.insert(member).values({
    id: crypto.randomUUID(),
    userId: user.id,
    organizationId: workspaceId,
    role: "owner",
    createdAt: new Date(),
  });

  await db
    .update(userTable)
    .set({ defaultWorkspaceId: workspaceId })
    .where(eq(userTable.id, user.id));

  return workspaceId;
}

/**
 * Workspace a new session should open in: the user's recorded default, else
 * their oldest membership. `undefined` when they belong to none, which
 * `requireWorkspace()` turns into an onboarding redirect.
 */
export async function resolveInitialWorkspaceId(
  userId: string,
): Promise<string | undefined> {
  // Independent reads, and neon-http makes each `await` its own round trip.
  const [[preferredRow], memberships] = await Promise.all([
    db
      .select({ defaultWorkspaceId: userTable.defaultWorkspaceId })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1),
    db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))
      .orderBy(asc(member.createdAt)),
  ]);

  const preferred = preferredRow?.defaultWorkspaceId;
  // Only honour the default if they are still a member of it.
  if (preferred && memberships.some((m) => m.organizationId === preferred)) {
    return preferred;
  }

  return memberships[0]?.organizationId;
}
