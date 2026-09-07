import { appleAppSiteAssociation } from "@/lib/drive/apple-app-site-association";
import { NextResponse } from "next/server";

export const dynamic = "force-static";

/** Apple fetches this without an extension; `application/json` is required. */
export function GET(): NextResponse {
  return new NextResponse(JSON.stringify(appleAppSiteAssociation), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    },
  });
}
