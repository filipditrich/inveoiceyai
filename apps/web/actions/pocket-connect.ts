"use server";

import { requireSession } from "@/lib/auth/session";
import {
  generatePocketPairCode,
  hashPocketSecret,
  isPocketPkceChallenge,
} from "@/lib/pocket/crypto";
import {
  appendPocketCallbackParams,
  isAllowedPocketRedirect,
} from "@/lib/pocket/redirect";

import { insertPocketPairGrant, listMemberWorkspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

export type PocketConnectResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: "invalid" | "unavailable" };

export async function confirmPocketConnectAction(input: {
  challenge: string;
  redirectUri: string;
  deviceName: string | null;
  workspaceId: string;
}): Promise<PocketConnectResult> {
  const challenge = input.challenge.trim();
  const redirectUri = input.redirectUri.trim();
  if (
    !isPocketPkceChallenge(challenge) ||
    !isAllowedPocketRedirect(redirectUri, env.NEXT_PUBLIC_APP_URL)
  ) {
    return { ok: false, error: "invalid" };
  }
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) return { ok: false, error: "unavailable" };
  const session = await requireSession();
  const workspaces = await listMemberWorkspaces(db, session.id);
  if (!workspaces.some((workspace) => workspace.id === input.workspaceId)) {
    return { ok: false, error: "invalid" };
  }
  const code = generatePocketPairCode();
  await insertPocketPairGrant(db, {
    userId: session.id,
    workspaceId: input.workspaceId,
    codeHash: hashPocketSecret(secret, code),
    codeChallenge: challenge,
    redirectUri,
    deviceName: input.deviceName?.trim().slice(0, 80) || null,
  });
  return {
    ok: true,
    redirectTo: appendPocketCallbackParams(redirectUri, { code }),
  };
}

export async function cancelPocketConnectAction(input: {
  redirectUri: string;
}): Promise<PocketConnectResult> {
  await requireSession();
  if (!isAllowedPocketRedirect(input.redirectUri, env.NEXT_PUBLIC_APP_URL)) {
    return { ok: false, error: "invalid" };
  }
  return {
    ok: true,
    redirectTo: appendPocketCallbackParams(input.redirectUri, {
      error: "access_denied",
    }),
  };
}
