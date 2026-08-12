import { recordToolActivity, tryCreateDbFromEnv } from "@invoicey/db";
import { env } from "@invoicey/env/server";
import { registerInvoiceyMcpTools } from "@invoicey/invoice-tools/mcp";
import {
  enterInvoiceyContext,
  getInvoiceyRequestContext,
} from "@invoicey/invoice-tools/workspace-context";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";

import { resolveMachineBearer } from "@/lib/auth/machine-bearer";

export const runtime = "nodejs";
export const maxDuration = 120;

const mcpHandler = createMcpHandler(
  (server) => {
    registerInvoiceyMcpTools(server, {
      onToolCall: async ({ toolName, isError }) => {
        const ctx = getInvoiceyRequestContext();
        const database = tryCreateDbFromEnv();
        if (!ctx?.workspaceId || !database) return;
        await recordToolActivity(database, {
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          product: "mcp",
          toolName,
          metadata: { isError },
        });
      },
    });
  },
  {
    serverInfo: {
      name: "invoicey",
      version: "0.1.0",
    },
  },
  {
    basePath: "/api",
    maxDuration: 120,
    disableSse: true,
  },
);

/** Env ops `MCP_API_KEY` or Better Auth user PAT; binds ALS workspace for tools. */
async function verifyMcpApiKey(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  const identity = await resolveMachineBearer(bearerToken, {
    opsKeys: [env.MCP_API_KEY],
  });
  if (!identity) {
    return undefined;
  }
  enterInvoiceyContext({
    workspaceId: identity.workspaceId,
    userId: identity.userId,
  });
  return {
    token: bearerToken ?? "",
    clientId: identity.kind === "ops" ? "ops-api-key" : identity.userId,
    scopes: ["invoicey"],
    extra: {
      kind: identity.kind,
      workspaceId: identity.workspaceId,
      userId: identity.userId,
    },
  };
}

const handler = withMcpAuth(mcpHandler, verifyMcpApiKey, {
  required: true,
});

export { handler as GET, handler as POST, handler as DELETE };
