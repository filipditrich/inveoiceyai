import { eq } from "drizzle-orm";

import type { InvoiceyDb } from "./create-db";
import { workspaces } from "./schema";

/** Seeded default workspace UUID (ADR 0006). */
export const DEFAULT_WORKSPACE_ID =
  "00000000-0000-4000-8000-000000000001";

export function getDefaultWorkspaceId(): string {
  const v = process.env.INVOICEY_DEFAULT_WORKSPACE_ID?.trim();
  return v != null && v.length > 0 ? v : DEFAULT_WORKSPACE_ID;
}

/** Inserts the workspace row when `id` is a UUID and missing. */
export async function ensureDefaultWorkspace(
  database: InvoiceyDb,
  options?: { id?: string; name?: string },
): Promise<{ id: string }> {
  const id = options?.id ?? getDefaultWorkspaceId();
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) {
    return { id };
  }

  const existing = await database
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, id))
    .limit(1);
  if (existing[0]) {
    return { id };
  }

  await database.insert(workspaces).values({
    id,
    name: options?.name ?? "Default workspace",
    // `slug` is required since Plan 14; derived from the id so lazily-created
    // workspaces cannot collide. Whole function goes away in Plan 14 stage 6,
    // once every caller resolves the workspace from the session instead.
    slug: `ws-${id.slice(0, 8)}`,
  });
  return { id };
}
