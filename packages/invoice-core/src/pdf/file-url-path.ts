import { fileURLToPath } from "node:url";

type HrefCarrier = { readonly href: string };

function hrefOf(url: string | URL | HrefCarrier): string | null {
  if (typeof url === "string") {
    return url;
  }
  if (url && typeof url.href === "string") {
    return url.href;
  }
  return null;
}

/**
 * Convert a `file:` URL to a filesystem path. Returns `null` for non-file
 * URLs and for bundler URL objects that Node's `fileURLToPath` rejects
 * (`ERR_INVALID_ARG_TYPE`: received a URL that is not a branded `URL`).
 */
export function localPathFromFileUrl(
  url: string | URL | HrefCarrier,
): string | null {
  const href = hrefOf(url);
  if (!href?.startsWith("file:")) {
    return null;
  }
  try {
    return fileURLToPath(href);
  } catch {
    return null;
  }
}
