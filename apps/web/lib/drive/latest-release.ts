import { z } from "zod";

export const INVOICEY_DRIVE_GITHUB_REPO = "filipditrich/invoicey-mac";
export const INVOICEY_DRIVE_DMG_ASSET = "InvoiceyDrive.dmg";
export const INVOICEY_DRIVE_DMG_DOWNLOAD_URL = `https://github.com/${INVOICEY_DRIVE_GITHUB_REPO}/releases/latest/download/${INVOICEY_DRIVE_DMG_ASSET}`;

const RELEASE_CORE = /v?(\d+\.\d+\.\d+)/i;

const githubReleaseSchema = z.object({
  tag_name: z.string(),
  assets: z.array(
    z.object({
      name: z.string(),
      browser_download_url: z.url(),
    }),
  ),
});

export type DriveLatestRelease = {
  version: string;
  dmgUrl: string;
};

export function driveDmgDownloadUrl(configuredUrl?: string): string {
  return (
    firstNonEmpty(configuredUrl, INVOICEY_DRIVE_DMG_DOWNLOAD_URL) ??
    INVOICEY_DRIVE_DMG_DOWNLOAD_URL
  );
}

export function normalizeReleaseVersion(raw: string): string | null {
  const match = raw.trim().match(RELEASE_CORE);
  return match?.[1] ?? null;
}

export function resolveDriveLatestRelease(input: {
  configuredVersion?: string;
  configuredDmgUrl?: string;
  github: DriveLatestRelease | null;
}): DriveLatestRelease | null {
  const version =
    normalizeReleaseVersion(input.configuredVersion ?? "") ??
    input.github?.version ??
    null;
  if (!version) {
    return null;
  }
  const dmgUrl = firstNonEmpty(
    input.configuredDmgUrl,
    INVOICEY_DRIVE_DMG_DOWNLOAD_URL,
    input.github?.dmgUrl,
  );
  if (!dmgUrl) {
    return null;
  }
  return { version, dmgUrl };
}

function firstNonEmpty(
  ...candidates: Array<string | undefined>
): string | undefined {
  return candidates.find((value) => value !== undefined && value.length > 0);
}

export async function loadGithubLatestRelease(
  fetchImpl: typeof fetch = fetch,
): Promise<DriveLatestRelease | null> {
  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${INVOICEY_DRIVE_GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "invoicey.app/drive-latest",
        },
      },
    );
    if (!response.ok) {
      return null;
    }
    const parsed = githubReleaseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return null;
    }
    const version = normalizeReleaseVersion(parsed.data.tag_name);
    const asset = parsed.data.assets.find(
      (item) => item.name === INVOICEY_DRIVE_DMG_ASSET,
    );
    if (!version || !asset) {
      return null;
    }
    return { version, dmgUrl: asset.browser_download_url };
  } catch {
    return null;
  }
}
