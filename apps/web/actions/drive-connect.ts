"use server";

import { requireSession } from "@/lib/auth/session";
import {
  generateDrivePairCode,
  hashDriveSecret,
  isPkceChallenge,
} from "@/lib/drive/crypto";
import {
  appendDriveCallbackParams,
  isAllowedDriveRedirect,
} from "@/lib/drive/redirect";

import { insertDrivePairGrant } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

export type DriveConnectResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: "invalid" | "unavailable" };

function parseConnectInput(input: {
  challenge: string;
  redirectUri: string;
  deviceName: string | null;
}): {
  challenge: string;
  redirectUri: string;
  deviceName: string | null;
} | null {
  const challenge = input.challenge.trim();
  const redirectUri = input.redirectUri.trim();
  if (!isPkceChallenge(challenge)) {
    return null;
  }
  if (!isAllowedDriveRedirect(redirectUri, env.NEXT_PUBLIC_APP_URL)) {
    return null;
  }
  const deviceName = input.deviceName?.trim().slice(0, 80) || null;
  return { challenge, redirectUri, deviceName };
}

export async function confirmDriveConnectAction(input: {
  challenge: string;
  redirectUri: string;
  deviceName: string | null;
}): Promise<DriveConnectResult> {
  const parsed = parseConnectInput(input);
  if (!parsed) {
    return { ok: false, error: "invalid" };
  }
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    return { ok: false, error: "unavailable" };
  }
  const session = await requireSession();
  const code = generateDrivePairCode();
  await insertDrivePairGrant(db, {
    userId: session.id,
    codeHash: hashDriveSecret(secret, code),
    codeChallenge: parsed.challenge,
    redirectUri: parsed.redirectUri,
    deviceName: parsed.deviceName,
  });
  return {
    ok: true,
    redirectTo: appendDriveCallbackParams(parsed.redirectUri, { code }),
  };
}

export async function cancelDriveConnectAction(input: {
  redirectUri: string;
}): Promise<DriveConnectResult> {
  await requireSession();
  if (!isAllowedDriveRedirect(input.redirectUri, env.NEXT_PUBLIC_APP_URL)) {
    return { ok: false, error: "invalid" };
  }
  return {
    ok: true,
    redirectTo: appendDriveCallbackParams(input.redirectUri, {
      error: "access_denied",
    }),
  };
}
