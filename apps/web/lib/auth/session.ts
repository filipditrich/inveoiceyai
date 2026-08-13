import "server-only";

import { member } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "./auth";
import { ForbiddenError, UnauthorizedError } from "./errors";
import { loadPlatformRole } from "./platform-admin";
import type { WorkspaceRole } from "./workspace-types";
import { setUserDefaultWorkspace } from "./workspaces";

export type { WorkspaceRole } from "./workspace-types";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface PlatformAdminContext {
  userId: string;
  email: string;
  name: string;
}

export interface WorkspaceContext {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

const ROLE_RANK: Record<WorkspaceRole, number> = {
  member: 0,
  admin: 1,
  owner: 2,
};

/**
 * Raw session read, memoised per request so a page calling `requireWorkspace()`
 * three times issues one lookup.
 */
const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Signed-in user, or a redirect to sign-in. Never returns null. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
  };
}

/** Session and workspace when present, else null. For optional-auth surfaces. */
export async function getOptionalWorkspace(): Promise<WorkspaceContext | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }
  return resolveWorkspace(
    session.user.id,
    session.session.activeOrganizationId,
  );
}

/**
 * The default accessor: the caller's user, active workspace, and role in it.
 *
 * Call this exactly once per request, at the outermost server boundary (page,
 * server action, route handler). Everything below that boundary should take
 * `workspaceId` as an explicit argument rather than reading ambient state —
 * that is what keeps the `workspace_id` predicate in ADR 0007 honest.
 */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const context = await resolveWorkspace(
    session.user.id,
    session.session.activeOrganizationId,
  );
  if (!context) {
    redirect("/onboarding");
  }
  return context;
}

/** Asserts membership of an explicitly supplied workspace id. */
export async function assertWorkspaceMember(
  workspaceId: string,
): Promise<WorkspaceContext> {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.userId, session.user.id),
        eq(member.organizationId, workspaceId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ForbiddenError();
  }
  return {
    userId: session.user.id,
    workspaceId,
    role: row.role as WorkspaceRole,
  };
}

/** Role gate for destructive workspace operations. */
export async function requireWorkspaceRole(
  minimum: "owner" | "admin",
): Promise<WorkspaceContext> {
  const context = await requireWorkspace();
  if (ROLE_RANK[context.role] < ROLE_RANK[minimum]) {
    throw new ForbiddenError(`Requires ${minimum} role`);
  }
  return context;
}

/** True when the signed-in user has `users.platform_role = admin` (DB flag). */
export async function isPlatformAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return (await loadPlatformRole(session.user.id)) === "admin";
}

/**
 * Platform ops console gate (ADR 0024). Reads the DB flag — not the env allowlist.
 * Redirects non-admins to the product dashboard.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const user = await requireSession();
  const role = await loadPlatformRole(user.id);
  if (role !== "admin") {
    redirect("/dashboard");
  }
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
  };
}

/** Same as `requirePlatformAdmin` but throws for server actions / route handlers. */
export async function assertPlatformAdmin(): Promise<PlatformAdminContext> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  const role = await loadPlatformRole(session.user.id);
  if (role !== "admin") {
    throw new ForbiddenError("Requires platform admin");
  }
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}

/**
 * Trusts `activeOrganizationId` only after confirming the membership row still
 * exists — a user removed from a workspace keeps the id in their session cookie
 * until it expires, and must not keep reading that workspace's data.
 */
async function resolveWorkspace(
  userId: string,
  activeOrganizationId: string | null | undefined,
): Promise<WorkspaceContext | null> {
  if (activeOrganizationId) {
    const [row] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, activeOrganizationId),
        ),
      )
      .limit(1);
    if (row) {
      return {
        userId,
        workspaceId: activeOrganizationId,
        role: row.role as WorkspaceRole,
      };
    }
  }

  // No active workspace, or membership revoked: fall back to the oldest one.
  const [fallback] = await db
    .select({ organizationId: member.organizationId, role: member.role })
    .from(member)
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt))
    .limit(1);

  if (!fallback) {
    return null;
  }

  // Repair stale/missing workspace state so the next request and API-key calls
  // resolve the same tenant instead of repeating an implicit fallback forever.
  try {
    await Promise.all([
      auth.api.setActiveOrganization({
        headers: await headers(),
        body: { organizationId: fallback.organizationId },
      }),
      setUserDefaultWorkspace(userId, fallback.organizationId),
    ]);
  } catch (error) {
    console.error("[workspace] failed to persist fallback workspace", error);
  }

  return {
    userId,
    workspaceId: fallback.organizationId,
    role: fallback.role as WorkspaceRole,
  };
}
