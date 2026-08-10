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

/** Bearer gate when `MCP_API_KEY` is set; open when unset (local). */
async function verifyMcpApiKey(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  const key = process.env.MCP_API_KEY?.trim();
  if (key == null || key === "") {
    return {
      token: "anonymous",
      clientId: "anonymous",
      scopes: [],
    };
  }
  if (bearerToken === key) {
    return {
      token: bearerToken,
      clientId: "api-key",
      scopes: ["invoicey"],
    };
  }
  return undefined;
}

const handler = withMcpAuth(mcpHandler, verifyMcpApiKey, {
  required: Boolean(process.env.MCP_API_KEY?.trim()),
});

export { handler as GET, handler as POST, handler as DELETE };
