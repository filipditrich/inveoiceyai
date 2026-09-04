/**
 * Maps Eve client errors to short copy. The raw message is sometimes an
 * entire Vercel Security Checkpoint HTML page — never show that in the panel.
 */

export function isAuthRequiredError(message: string): boolean {
  return message.toLowerCase().includes("authorization is required");
}

/** Vercel Security Checkpoint / other HTML interstitials returned as the body. */
export function isSecurityCheckpointError(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes("enable javascript to continue")) return true;
  if (lower.includes("vercel.link/security-checkpoint")) return true;
  if (lower.includes("we're verifying your browser")) return true;
  if (/^\s*<!doctype html/iu.test(message)) return true;
  if (/^\s*<html[\s>]/iu.test(message)) return true;
  return false;
}

export function isReloadableAssistantError(message: string): boolean {
  return isAuthRequiredError(message) || isSecurityCheckpointError(message);
}

export function friendlyAssistantError(
  message: string,
  t: (key: "authRequired" | "blocked") => string,
): string {
  if (isAuthRequiredError(message)) return t("authRequired");
  if (isSecurityCheckpointError(message)) return t("blocked");
  return message;
}
