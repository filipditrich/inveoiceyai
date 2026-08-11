import {
  ensureDefaultWorkspace as ensureDefaultWorkspaceDb,
  getDefaultWorkspaceId,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

/**
 * Workspace scope until auth lands (Plan 14 stage 5 deletes this file).
 *
 * Thin wrappers over `@invoicey/db` so there is one implementation — these were
 * a second copy that had already drifted from it.
 */
export { getDefaultWorkspaceId };

/** Ensures the default workspace row exists (idempotent). */
export async function ensureDefaultWorkspace(): Promise<string> {
  const { id } = await ensureDefaultWorkspaceDb(db);
  return id;
}
