import "server-only";
import { eq } from "drizzle-orm";

import { user } from "@invoicey/db";
import { getDefaultWorkspaceId } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

import { auth } from "./auth";

export type MachineBearerIdentity =
  | {
      kind: "ops";
      workspaceId: string;
      userId?: undefined;
    }
  | {
      kind: "user";
      userId: string;
      workspaceId: string;
    };

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/** Ops env key → default workspace; else Better Auth PAT → user.defaultWorkspaceId. */
export async function resolveMachineBearer(
  bearerToken: string | undefined | null,
  opts?: { opsKeys?: Array<string | undefined | null> },
): Promise<MachineBearerIdentity | null> {
  const token = bearerToken?.trim();
  if (!token) return null;

  const opsKeys = (opts?.opsKeys ?? [env.MCP_API_KEY]).filter(
    (k): k is string => Boolean(k?.trim()),
  );
  for (const key of opsKeys) {
    if (timingSafeEqualString(token, key.trim())) {
      return { kind: "ops", workspaceId: getDefaultWorkspaceId() };
    }
  }

  try {
    const result = await auth.api.verifyApiKey({
      body: { key: token },
    });
    if (!result?.valid || !result.key?.referenceId) {
      return null;
    }
    const userId = result.key.referenceId;
    const [row] = await db
      .select({ defaultWorkspaceId: user.defaultWorkspaceId })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const workspaceId = row?.defaultWorkspaceId?.trim();
    if (!workspaceId) {
      return null;
    }
    return { kind: "user", userId, workspaceId };
  } catch (err) {
    console.error("[invoicey] verifyApiKey failed", err);
    return null;
  }
}
