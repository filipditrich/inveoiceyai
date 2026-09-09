import "server-only";
import { NextResponse } from "next/server";

import { getWorkspaceEntitlements, readBooleanEntitlement } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

import { resolveMachineBearer } from "./machine-bearer";
import { getOptionalWorkspace } from "./session";

function bearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token.trim() || undefined;
}

async function workspaceCanRenderInvoices(
  workspaceId: string,
): Promise<boolean> {
  const resolved = await getWorkspaceEntitlements(db, workspaceId);
  if (!resolved) return false;
  return readBooleanEntitlement(
    resolved.entitlements,
    "features.invoiceRender",
  );
}

function forbidden(): NextResponse {
  return NextResponse.json(
    { error: "forbidden", feature: "invoiceRender" },
    { status: 403 },
  );
}

/**
 * Cookie session or companion PAT / ops key. Auth is a gate only —
 * this surface does not read workspace issuers or invoices.
 * Session and user PATs also need `features.invoiceRender`. Ops keys do not.
 */
export async function requireInvoiceRenderAuth(
  request: Request,
): Promise<{ ok: true } | { response: NextResponse }> {
  const workspace = await getOptionalWorkspace();
  if (workspace) {
    if (!(await workspaceCanRenderInvoices(workspace.workspaceId))) {
      return { response: forbidden() };
    }
    return { ok: true };
  }
  const identity = await resolveMachineBearer(bearerToken(request), {
    opsKeys: [env.MCP_API_KEY],
  });
  if (!identity) {
    return {
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  if (identity.kind === "ops") {
    return { ok: true };
  }
  if (!(await workspaceCanRenderInvoices(identity.workspaceId))) {
    return { response: forbidden() };
  }
  return { ok: true };
}
