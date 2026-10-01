import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";

import { registerInvoiceyMcpTools } from "./register-mcp-tools";

const close: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(close.splice(0).map((fn) => fn()));
});
async function connect(denied = false) {
  const server = new McpServer({ name: "test", version: "1" });
  registerInvoiceyMcpTools(server, {
    authorize: async () => (denied ? "forbidden" : null),
  });
  const client = new Client({ name: "test-client", version: "1" });
  const [local, remote] = InMemoryTransport.createLinkedPair();
  await server.connect(remote);
  await client.connect(local);
  close.push(
    () => client.close(),
    () => server.close(),
  );
  return client;
}
describe("MCP wire contract", () => {
  it("denies invoice reads before querying workspace data", async () => {
    const client = await connect(true);
    const result = await client.callTool({
      name: "list_invoices",
      arguments: {},
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      ok: false,
      error: "forbidden",
    });
  });
  it("rejects malformed IČO before contacting ARES", async () => {
    const client = await connect();
    const result = await client.callTool({
      name: "lookup_business",
      arguments: { ico: "123" },
    });
    expect(result.isError).toBe(true);
  });
  it("tells hosts which actions send data externally and cannot be retried safely", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(
      tools.find((tool) => tool.name === "send_invoice_email")?.annotations,
    ).toMatchObject({
      readOnlyHint: false,
      openWorldHint: true,
      idempotentHint: false,
    });
    expect(
      tools.find((tool) => tool.name === "list_invoices")?.annotations,
    ).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(
      tools.find((tool) => tool.name === "create_invoice")?.inputSchema
        .properties?.draft,
    ).toHaveProperty("properties.client");
  });
});
