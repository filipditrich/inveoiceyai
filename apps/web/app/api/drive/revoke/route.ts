import { recordSecurityAuditEvent } from "@/lib/auth/security-audit";
import { hashDriveSecret } from "@/lib/drive/crypto";
import { requireDriveDevice } from "@/lib/drive/device-auth";
import { NextResponse } from "next/server";

import { revokeDriveDeviceByTokenHash } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const gate = await requireDriveDevice(request, { touch: false });
  if ("response" in gate) {
    return gate.response;
  }
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "drive_unavailable" }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  const raw = header.split(" ")[1]?.trim() ?? "";
  const revoked = await revokeDriveDeviceByTokenHash(
    db,
    hashDriveSecret(secret, raw),
  );
  if (!revoked) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await recordSecurityAuditEvent({
    userId: revoked.userId,
    type: "drive_device_revoke",
    metadata: { deviceId: revoked.deviceId, source: "device" },
  });
  return NextResponse.json({ ok: true });
}
