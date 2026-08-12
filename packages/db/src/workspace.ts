import { eq } from "drizzle-orm";

import { ensureAiTokenBalance } from "./ai-tokens";
import type { InvoiceyDb } from "./create-db";
import { workspaces } from "./schema";

/** Seeded default workspace UUID (ADR 0006). */
export const DEFAULT_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";

export function getDefaultWorkspaceId(): string {
  const v = process.env.INVOICEY_DEFAULT_WORKSPACE_ID?.trim();
  return v != null && v.length > 0 ? v : DEFAULT_WORKSPACE_ID;
}

/**
 * Inserts the workspace row when missing.
 *
 * Does not require `id` to be a UUID: `workspaces.id` is `text`, and skipping
 * the insert for other shapes returned an id with no row behind it, so every
 * page filtered on it and silently rendered empty.
 */
export async function ensureDefaultWorkspace(
  database: InvoiceyDb,
  options?: { id?: string; name?: string },
): Promise<{ id: string }> {
  const id = options?.id ?? getDefaultWorkspaceId();

  const existing = await database
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, id))
    .limit(1);
  if (existing[0]) {
    await ensureAiTokenBalance(database, id);
    return { id };
  }

  await database.insert(workspaces).values({
    id,
    name: options?.name ?? "Default workspace",
    // `slug` is required since Plan 14. Uses the whole id, not a prefix, so it
    // inherits the primary key's uniqueness. Whole function goes away in Plan
    // 14 stage 6, once callers resolve the workspace from the session instead.
    slug: `ws-${id}`,
  });
  await ensureAiTokenBalance(database, id);
  return { id };
}
