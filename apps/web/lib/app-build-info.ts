/**
 * Build-time app identity — baked in via `next.config.ts` `env`.
 * Safe to import from client components (`NEXT_PUBLIC_*`).
 */
export const APP_VERSION =
	process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.0.0";

/** Short git SHA of the deployed commit (`dev` when unknown). */
export const APP_GIT_SHA =
	process.env.NEXT_PUBLIC_GIT_COMMIT_SHA?.trim() || "dev";
