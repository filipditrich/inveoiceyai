import { workspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { defaultLookRef, type LookRef } from "@invoicey/invoice-core/looks";
import { eq } from "drizzle-orm";

export async function loadWorkspaceDefaultLook(
  workspaceId: string,
): Promise<LookRef> {
  const [row] = await db
    .select({
      defaultLookId: workspaces.defaultLookId,
      defaultLookVersion: workspaces.defaultLookVersion,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!row) return defaultLookRef();
  return { id: row.defaultLookId, version: row.defaultLookVersion };
}
