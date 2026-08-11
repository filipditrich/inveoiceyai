import { env } from "@invoicey/env/server";
import { registerInvoiceyMcpTools } from "@invoicey/invoice-tools/mcp";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";

export const runtime = "nodejs";
export const maxDuration = 120;

const mcpHandler = createMcpHandler(
  (server) => {
    registerInvoiceyMcpTools(server);
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

/**
 * Require `Authorization: Bearer` matching validated `MCP_API_KEY`.
 * Fails closed when the key is unset — no key configured means no access.
 */
async function verifyMcpApiKey(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  const expected = env.MCP_API_KEY;
  if (!expected) {
    return undefined;
  }
  if (bearerToken === expected) {
    return {
      token: bearerToken,
      clientId: "api-key",
      scopes: ["invoicey"],
    };
  }
  return undefined;
}

const handler = withMcpAuth(mcpHandler, verifyMcpApiKey, {
  required: true,
});

export { handler as GET, handler as POST, handler as DELETE };
