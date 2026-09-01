import { NextResponse } from "next/server";

import { env } from "@invoicey/env/server";
import { runWithInvoiceyContext } from "@invoicey/invoice-tools/workspace-context";

import { resolveMachineBearer } from "./machine-bearer";

export type CompanionIdentity = {
  kind: "ops" | "user";
  workspaceId: string;
  userId?: string;
};

function bearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token.trim() || undefined;
}

/** PAT or ops MCP key; binds ALS for companion handlers. */
export async function requireCompanionAuth(
  request: Request,
): Promise<{ identity: CompanionIdentity } | { response: NextResponse }> {
  const identity = await resolveMachineBearer(bearerToken(request), {
    opsKeys: [env.MCP_API_KEY],
  });
  if (!identity) {
    return {
      response: NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      ),
    };
  }
  return {
    identity: {
      kind: identity.kind,
      workspaceId: identity.workspaceId,
      userId: identity.userId,
    },
  };
}

export function withCompanionContext<T>(
  identity: CompanionIdentity,
  fn: () => T,
): T {
  return runWithInvoiceyContext(
    { workspaceId: identity.workspaceId, userId: identity.userId },
    fn,
  );
}
