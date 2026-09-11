import { recordSecurityAuditEvent } from "@/lib/auth/security-audit";
import {
  generatePocketDeviceToken,
  hashPocketSecret,
  pocketTokenFingerprint,
  verifyPocketPkceS256,
} from "@/lib/pocket/crypto";
import { isAllowedPocketRedirect } from "@/lib/pocket/redirect";
import { NextResponse } from "next/server";

import { consumePocketPairGrant, insertPocketDevice } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "pocket_unavailable" }, { status: 503 });
  }
  let body: { code?: unknown; verifier?: unknown; redirectUri?: unknown };
  try {
    body = (await request.json()) as typeof body;
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
  if (!isAllowedPocketRedirect(redirectUri, env.NEXT_PUBLIC_APP_URL)) {
    return NextResponse.json({ error: "invalid_redirect" }, { status: 400 });
  }
  const grant = await consumePocketPairGrant(
    db,
    hashPocketSecret(secret, code),
  );
  if (
    !grant ||
    grant.redirectUri !== redirectUri ||
    !verifyPocketPkceS256({ verifier, challenge: grant.codeChallenge })
  ) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }
  const token = generatePocketDeviceToken();
  const tokenHash = hashPocketSecret(secret, token);
  const device = await insertPocketDevice(db, {
    userId: grant.userId,
    workspaceId: grant.workspaceId,
    name: grant.deviceName?.trim() || "iPhone",
    tokenHash,
    tokenFingerprint: pocketTokenFingerprint(tokenHash),
  });
  await recordSecurityAuditEvent({
    userId: grant.userId,
    type: "pocket_device_create",
    metadata: { deviceId: device.id, workspaceId: device.workspaceId },
  });
  return NextResponse.json({
    token,
    deviceId: device.id,
    workspaceId: device.workspaceId,
  });
}
