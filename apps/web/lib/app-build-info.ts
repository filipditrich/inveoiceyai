import { z } from "zod";

/**
 * Build-time app identity — baked in via `next.config.ts` `env`.
 * Safe to import from client components (`NEXT_PUBLIC_*`).
 */
export const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.0.0";

export const UNKNOWN_GIT_SHA = "dev";

/** Short git SHA of the deployed commit (`dev` when unknown). */
export const APP_GIT_SHA =
  process.env.NEXT_PUBLIC_GIT_COMMIT_SHA?.trim() || UNKNOWN_GIT_SHA;

const SHORT_GIT_SHA_LENGTH = 7;

export interface AppBuildInfo {
  version: string;
  sha: string;
}

export const AppBuildInfoSchema = z.object({
  version: z.string().trim().min(1),
  sha: z.string().trim().min(1),
});

/** True when this tab's SHA is not the live deployment (prefix-aware). */
export function isBuildStale(input: {
  runningSha: string;
  liveSha: string;
}): boolean {
  const running = normalizeSha(input.runningSha);
  const live = normalizeSha(input.liveSha);
  if (
    running === UNKNOWN_GIT_SHA ||
    live === UNKNOWN_GIT_SHA ||
    running.length < SHORT_GIT_SHA_LENGTH ||
    live.length < SHORT_GIT_SHA_LENGTH
  ) {
    return false;
  }
  const shorter = running.length <= live.length ? running : live;
  const longer = running.length <= live.length ? live : running;
  return !longer.startsWith(shorter);
}

function normalizeSha(sha: string): string {
  return sha.trim().toLowerCase();
}
