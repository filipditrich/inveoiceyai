import { recordSecurityAuditEvent } from "@/lib/auth/security-audit";
import {
  driveTokenFingerprint,
  generateDriveDeviceToken,
  hashDriveSecret,
  verifyPkceS256,
} from "@/lib/drive/crypto";
import { isAllowedDriveRedirect } from "@/lib/drive/redirect";
import { NextResponse } from "next/server";

import { consumeDrivePairGrant, insertDriveDevice } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

export const runtime = "nodejs";

interface TokenBody {
  code?: unknown;
  verifier?: unknown;
  redirectUri?: unknown;
}

export async function POST(request: Request) {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "drive_unavailable" }, { status: 503 });
  }
  let body: TokenBody;
  try {
    body = (await request.json()) as TokenBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : "";
  const verifier = typeof body.verifier === "string" ? body.verifier : "";
  const redirectUri =
    typeof body.redirectUri === "string" ? body.redirectUri : "";
  if (!code || !verifier || !redirectUri) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!isAllowedDriveRedirect(redirectUri, env.NEXT_PUBLIC_APP_URL)) {
    return NextResponse.json({ error: "invalid_redirect" }, { status: 400 });
  }
  const grant = await consumeDrivePairGrant(db, hashDriveSecret(secret, code));
  if (!grant || grant.redirectUri !== redirectUri) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }
  if (!verifyPkceS256({ verifier, challenge: grant.codeChallenge })) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }
  const token = generateDriveDeviceToken();
  const tokenHash = hashDriveSecret(secret, token);
  const device = await insertDriveDevice(db, {
    userId: grant.userId,
    name: grant.deviceName?.trim() || "Mac",
    tokenHash,
    tokenFingerprint: driveTokenFingerprint(tokenHash),
  });
  await recordSecurityAuditEvent({
    userId: grant.userId,
    type: "drive_device_create",
    metadata: { deviceId: device.id, name: device.name },
  });
  return NextResponse.json({ token, deviceId: device.id });
}
