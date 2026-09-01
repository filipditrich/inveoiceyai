import { requireDriveDevice } from "@/lib/drive/device-auth";
import { NextResponse } from "next/server";

import { listDriveIndex } from "@invoicey/db";
import { db } from "@invoicey/db/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireDriveDevice(request);
  if ("response" in gate) {
    return gate.response;
  }
  const items = await listDriveIndex(db, gate.device.userId);
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    items,
  });
}
