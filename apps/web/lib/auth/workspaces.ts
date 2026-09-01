import "server-only";
import { cache } from "react";
import { asc, eq } from "drizzle-orm";

import { member, user as userTable, workspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";

import type { WorkspaceListItem, WorkspaceRole } from "./workspace-types";

export type { WorkspaceListItem, WorkspaceRole } from "./workspace-types";
export {
  isOrganizationSlugConflict,
  randomSlugSuffix,
  slugifyWorkspaceName,
} from "./workspace-slug";

/** Memberships joined to workspace rows, oldest membership first. */
export const listUserWorkspaces = cache(
  async (userId: string): Promise<WorkspaceListItem[]> => {
    const rows = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        logo: workspaces.logo,
        role: member.role,
      })
      .from(member)
      .innerJoin(workspaces, eq(member.organizationId, workspaces.id))
      .where(eq(member.userId, userId))
      .orderBy(asc(member.createdAt));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      logo: row.logo,
      role: row.role as WorkspaceRole,
    }));
  },
);

/** Default workspace used by PAT / MCP machine identity. */
export const getUserDefaultWorkspaceId = cache(
  async (userId: string): Promise<string | null> => {
    const [row] = await db
      .select({ defaultWorkspaceId: userTable.defaultWorkspaceId })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    return row?.defaultWorkspaceId?.trim() || null;
  },
);

/**
 * Points machine identities (API keys) at this workspace. Caller must already
 * have verified membership.
 */
export async function setUserDefaultWorkspace(
  userId: string,
  workspaceId: string,
): Promise<void> {
  await db
    .update(userTable)
    .set({ defaultWorkspaceId: workspaceId })
    .where(eq(userTable.id, userId));
}
