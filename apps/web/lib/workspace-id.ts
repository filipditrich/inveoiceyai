import { DEFAULT_WORKSPACE_ID } from "@invoicey/db";

/**
 * Workspace scope until Clerk (Plan 14). Mirrors `INVOICEY_DEFAULT_WORKSPACE_ID` in `.env.example`.
 */
export function getDefaultWorkspaceId(): string {
	const v = process.env.INVOICEY_DEFAULT_WORKSPACE_ID?.trim();
	return (v?.length ?? 0) > 0 ? v! : DEFAULT_WORKSPACE_ID;
}
