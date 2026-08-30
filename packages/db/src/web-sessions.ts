import { and, eq, gt } from "drizzle-orm";

import { member, session, user } from "./auth-schema";
import type { InvoiceyDb } from "./create-db";

/**
 * Better Auth session lookup for callers that cannot use the Next.js server
 * helpers.
 *
 * `lib/auth/session.ts` reads the session through `auth.api.getSession()`, which
 * needs `next/headers` and `server-only`. The Eve runtime is a separate service
 * with neither, so the browser chat authenticates by presenting the same cookie
 * and having it resolved here, straight against the tables Better Auth owns.
 * Same tenancy rule as `requireWorkspace()`: `activeOrganizationId` is the
 * workspace, and membership is re-checked rather than trusted.
 */
export interface WebSessionPrincipal {
  userId: string;
  workspaceId: string;
  email: string;
  name: string;
}

export type ResolvedWebSession =
  | { status: "authenticated"; principal: WebSessionPrincipal }
  /** No session row, or it expired. */
  | { status: "anonymous" }
  /** Signed in, but the session has no workspace we can act in. */
  | { status: "no_workspace"; userId: string };

export async function resolveWebSessionPrincipal(
  db: InvoiceyDb,
  input: { sessionToken: string },
  now = new Date(),
): Promise<ResolvedWebSession> {
  const token = input.sessionToken.trim();
  if (!token) return { status: "anonymous" };

  const [row] = await db
    .select({
      userId: session.userId,
      activeOrganizationId: session.activeOrganizationId,
      email: user.email,
      name: user.name,
      defaultWorkspaceId: user.defaultWorkspaceId,
    })
    .from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .where(and(eq(session.token, token), gt(session.expiresAt, now)))
    .limit(1);

  if (!row) return { status: "anonymous" };

  const workspaceId =
    row.activeOrganizationId?.trim() || row.defaultWorkspaceId?.trim() || "";
  if (!workspaceId) return { status: "no_workspace", userId: row.userId };

  const [membership] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.userId, row.userId),
        eq(member.organizationId, workspaceId),
      ),
    )
    .limit(1);
  if (!membership) return { status: "no_workspace", userId: row.userId };

  return {
    status: "authenticated",
    principal: {
      userId: row.userId,
      workspaceId,
      email: row.email,
      name: row.name,
    },
  };
}
