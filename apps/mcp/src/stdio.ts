import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerInvoiceyMcpTools } from "@invoicey/invoice-tools/mcp";

/** Local stdio MCP entry (stdout is the protocol stream). */
async function main(): Promise<void> {
  const server = new McpServer({
    name: "invoicey",
    version: "0.1.0",
  });
  registerInvoiceyMcpTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[invoicey-mcp] stdio server ready");
}

main().catch((err: unknown) => {
  console.error("[invoicey-mcp] fatal", err);
  process.exit(1);
});
