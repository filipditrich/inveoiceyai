import { db, workspaces } from "@invoicey/db";
import { eq } from "drizzle-orm";

/** Stable demo workspace when env is unset (must be a UUID). */
export const DEMO_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Workspace scope until Clerk (Plan 14).
 * Prefers `INVOICEY_DEFAULT_WORKSPACE_ID`; falls back to a fixed demo UUID (not `"default"`).
 */
export function getDefaultWorkspaceId(): string {
	const v = process.env.INVOICEY_DEFAULT_WORKSPACE_ID?.trim();
	if (v && v.length > 0) {
		return v;
	}
	return DEMO_WORKSPACE_ID;
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
