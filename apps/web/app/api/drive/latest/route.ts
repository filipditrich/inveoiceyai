import {
  loadGithubLatestRelease,
  resolveDriveLatestRelease,
} from "@/lib/drive/latest-release";
import { NextResponse } from "next/server";

import { env } from "@invoicey/env/server";

export const runtime = "nodejs";
export const revalidate = 3600;

const CACHE = "public, max-age=300, s-maxage=3600";

/**
 * Public latest Invoicey Drive build. The Mac app compares this to
 * CFBundleShortVersionString. Version comes from GitHub Releases so
 * Vercel does not need a bump on every tag.
 */
export async function GET(): Promise<NextResponse> {
  const github = await loadGithubLatestRelease((url, init) =>
    fetch(url, { ...init, next: { revalidate: 3600 } }),
  );
  const latest = resolveDriveLatestRelease({
    configuredVersion: env.INVOICEY_DRIVE_VERSION,
    configuredDmgUrl: env.INVOICEY_DRIVE_DMG_URL,
    github,
  });
  if (!latest) {
    return NextResponse.json(
      { error: "drive_release_unavailable" },
      { status: 503 },
    );
  }
  return NextResponse.json(latest, {
    headers: {
      "Cache-Control": CACHE,
    },
  });
}
