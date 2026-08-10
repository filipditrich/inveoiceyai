import { DEFAULT_WORKSPACE_ID, workspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { eq } from "drizzle-orm";

/**
 * Workspace scope until Clerk (Plan 14).
 * Prefers `INVOICEY_DEFAULT_WORKSPACE_ID`; falls back to the seeded demo UUID.
 */
export function getDefaultWorkspaceId(): string {
	const v = process.env.INVOICEY_DEFAULT_WORKSPACE_ID?.trim();
	if (v && v.length > 0) {
		return v;
	}
	return DEFAULT_WORKSPACE_ID;
}

/** Ensures the default workspace row exists (idempotent). */
export async function ensureDefaultWorkspace(): Promise<string> {
	const id = getDefaultWorkspaceId();
	const existing = await db
		.select({ id: workspaces.id })
		.from(workspaces)
		.where(eq(workspaces.id, id))
		.limit(1);
	if (!existing[0]) {
		await db.insert(workspaces).values({
			id,
			name: "Default workspace",
		});
	}
	return id;
}
