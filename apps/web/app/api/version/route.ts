import { APP_GIT_SHA, APP_VERSION } from "@/lib/app-build-info";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = "no-store, max-age=0";

/** Live deploy identity for stale-tab checks. Public: version and short SHA are not secrets. */
export function GET(): NextResponse {
  return NextResponse.json(
    { version: APP_VERSION, sha: APP_GIT_SHA },
    {
      headers: {
        "Cache-Control": NO_STORE,
        "CDN-Cache-Control": NO_STORE,
      },
    },
  );
}
