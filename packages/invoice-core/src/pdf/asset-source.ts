const TRUSTED_IMAGE_HOSTS = ["ufs.sh", "utfs.io", "uploadthing.com"] as const;

export function isTrustedInvoiceImageUrl(source: string): boolean {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  return TRUSTED_IMAGE_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

export function isInlineInvoiceImage(source: string): boolean {
  return /^data:image\/(?:png|jpe?g);base64,/iu.test(source);
}
