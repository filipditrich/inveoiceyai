const CUSTOM_SCHEME = "invoicey-pocket:";
const CANONICAL_ORIGIN = "https://invoicey.app";
const LEGACY_ORIGIN = "https://invoicey.ditrich.me";

export function isAllowedPocketRedirect(
  raw: string,
  appOrigin: string,
): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  if (url.protocol === CUSTOM_SCHEME) {
    return (
      url.hostname === "oauth" && (url.pathname === "" || url.pathname === "/")
    );
  }
  if (url.protocol !== "https:" || url.pathname !== "/pocket/oauth") {
    return false;
  }
  let configuredOrigin = "";
  try {
    configuredOrigin = new URL(appOrigin).origin;
  } catch {
    /** Invalid configuration is never allowed. */
  }
  return [CANONICAL_ORIGIN, LEGACY_ORIGIN, configuredOrigin].includes(
    url.origin,
  );
}

export function appendPocketCallbackParams(
  redirectUri: string,
  params: Record<string, string>,
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
