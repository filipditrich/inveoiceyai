const CUSTOM_SCHEME = "invoicey-drive:";
const CANONICAL_ORIGIN = "https://invoicey.app";
/** keep serving Drive callbacks on the old host during the cutover window */
const LEGACY_ORIGIN = "https://invoicey.ditrich.me";

function isLocalHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

/**
 * Pairing callback allowlist: custom scheme, loopback /oauth, and the
 * production Associated Domains path.
 */
export function isAllowedDriveRedirect(
  raw: string,
  appOrigin: string,
): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) {
    return false;
  }
  if (url.protocol === CUSTOM_SCHEME) {
    return (
      url.hostname === "oauth" && (url.pathname === "" || url.pathname === "/")
    );
  }
  if (url.pathname !== "/oauth" && url.pathname !== "/drive/oauth") {
    return false;
  }
  if (url.protocol === "http:" && isLocalHostname(url.hostname)) {
    return url.pathname === "/oauth";
  }
  if (url.protocol !== "https:") {
    return false;
  }
  let configuredOrigin: string;
  try {
    configuredOrigin = new URL(appOrigin).origin;
  } catch {
    configuredOrigin = "";
  }
  const origin = url.origin;
  if (
    origin === CANONICAL_ORIGIN ||
    origin === LEGACY_ORIGIN ||
    origin === configuredOrigin
  ) {
    return url.pathname === "/drive/oauth" || url.pathname === "/oauth";
  }
  return false;
}

export function appendDriveCallbackParams(
  redirectUri: string,
  params: Record<string, string>,
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
