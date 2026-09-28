import { requireDriveDevice } from "@/lib/drive/device-auth";
import { NextResponse } from "next/server";

import {
  ifNoneMatchHits,
  listDriveIndex,
  readDriveIndexEtag,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

export const runtime = "nodejs";

const INDEX_HEADERS = {
  "Cache-Control": "private, no-cache",
} as const;

export async function GET(request: Request) {
  const gate = await requireDriveDevice(request);
  if ("response" in gate) {
    return gate.response;
  }
  const etag = await readDriveIndexEtag(db, gate.device.userId);
  const headers = { ...INDEX_HEADERS, ETag: etag };
  if (ifNoneMatchHits(request.headers.get("if-none-match"), etag)) {
    return new NextResponse(null, { status: 304, headers });
  }
  const items = await listDriveIndex(db, gate.device.userId);
  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      items,
    },
    { headers },
  );
}
