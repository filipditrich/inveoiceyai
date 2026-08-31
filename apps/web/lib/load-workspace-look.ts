import { listWorkspaceLookRows, workspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  defaultLookRef,
  LookDocumentSchema,
  type LookDocument,
  type LookRef,
} from "@invoicey/invoice-core/looks";
import { loadWorkspaceLookContext } from "@invoicey/invoice-tools/ops";
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

export async function loadWorkspaceLookDocuments(
  workspaceId: string,
): Promise<LookDocument[]> {
  const rows = await listWorkspaceLookRows(db, workspaceId);
  const looks: LookDocument[] = [];
  for (const row of rows) {
    const parsed = LookDocumentSchema.safeParse(row.document);
    if (parsed.success) looks.push(parsed.data);
  }
  return looks;
}

/** Workspace looks plus published community looks — picker and issue resolve. */
export async function loadLookCatalog(
  workspaceId: string,
): Promise<LookDocument[]> {
  const context = await loadWorkspaceLookContext(db, workspaceId);
  return context.catalog;
}
