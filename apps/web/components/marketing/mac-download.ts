const RELEASES_FALLBACK =
  "https://github.com/filipditrich/invoicey-mac/releases";

/** Until a signed build is published, the download points at the release list. */
export function macDownloadUrl(configuredUrl: string | undefined): string {
  return configuredUrl ?? RELEASES_FALLBACK;
}

export const CLI_INSTALL_COMMAND =
  "curl -fsSL https://invoicey.app/install | bash";
