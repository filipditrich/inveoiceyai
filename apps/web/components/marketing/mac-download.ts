import { driveDmgDownloadUrl } from "@/lib/drive/latest-release";

/** Notarized `.dmg`. Env wins; otherwise the GitHub latest asset. */
export function macDownloadUrl(configuredUrl: string | undefined): string {
  return driveDmgDownloadUrl(configuredUrl);
}

export const CLI_INSTALL_COMMAND =
  "curl -fsSL https://invoicey.app/install | bash";
