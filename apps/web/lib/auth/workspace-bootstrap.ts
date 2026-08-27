import "server-only";

import {
  initialAiTokenBalanceValues,
  member,
  user as userTable,
  workspaces,
  aiTokenBalances,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { withDbTransaction } from "@invoicey/db/transaction";
import { asc, eq } from "drizzle-orm";

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

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
 *
 * All three writes share one transaction. `user.create.after` only ever fires
 * once per user, so a partial failure would otherwise leave the account with no
 * membership forever — and no way to retry, since the hook never runs again.
 */
export async function createPersonalWorkspace(
  user: CreatedUser,
): Promise<string> {
  const workspaceId = crypto.randomUUID();
  // This hook runs outside a request, so there is no UI locale to translate a
  // suffix into. The user's own name reads correctly in either catalog, and the
  // welcome wizard asks them to confirm or change it before they issue anything.
  const name = user.name?.trim() || user.email?.split("@")[0] || "Workspace";
  const base = slugBase(user);

  // The slug retry wraps the transaction rather than sitting inside it: a
  // failed statement aborts a Postgres transaction, so a second INSERT on the
  // same tx would fail with "current transaction is aborted" regardless of the
  // new slug. Each attempt therefore gets a fresh transaction.
  let slug = base;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await withDbTransaction(async (tx) => {
        await tx.insert(workspaces).values({ id: workspaceId, name, slug });

        await tx.insert(member).values({
          id: crypto.randomUUID(),
          userId: user.id,
          organizationId: workspaceId,
          role: "owner",
          createdAt: new Date(),
        });

        await tx
          .insert(aiTokenBalances)
          .values(initialAiTokenBalanceValues(workspaceId));

        await tx
          .update(userTable)
          .set({ defaultWorkspaceId: workspaceId })
          .where(eq(userTable.id, user.id));

        return workspaceId;
      });
    } catch (error) {
      if (attempt >= 4 || !isUniqueViolation(error)) throw error;
      slug = `${base}-${randomSuffix()}`;
    }
  }
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
