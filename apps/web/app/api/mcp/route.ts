import { authenticateMcp } from "@/lib/mcp/authenticate";
import { MCP_ORIGIN, mcpChallenge } from "@/lib/mcp/config";
import { createInvoiceyMcpServer } from "@/lib/mcp/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { runWithInvoiceyContext } from "@invoicey/invoice-tools/workspace-context";

export const runtime = "nodejs";
export const maxDuration = 120;
const allowedOrigins = new Set([
  MCP_ORIGIN,
  "https://chatgpt.com",
  "https://chat.openai.com",
]);
function responseHeaders() {
  return {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "WWW-Authenticate",
  };
}
function unauthorized() {
  return Response.json(
    { error: "unauthorized" },
    {
      status: 401,
      headers: { ...responseHeaders(), "WWW-Authenticate": mcpChallenge() },
    },
  );
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins.has(origin))
    return Response.json({ error: "forbidden_origin" }, { status: 403 });
  const token = /^Bearer (.+)$/i.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  const principal = token ? await authenticateMcp(token) : null;
  if (!principal) return unauthorized();
  return runWithInvoiceyContext(principal, async () => {
    const server = createInvoiceyMcpServer(principal);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request);
      for (const [key, value] of Object.entries(responseHeaders()))
        response.headers.set(key, value);
      return response;
    } finally {
      await server.close();
    }
  });
}
export function GET(request: Request) {
  if (!request.headers.has("authorization")) return unauthorized();
  return new Response(null, {
    status: 405,
    headers: { ...responseHeaders(), Allow: "POST, OPTIONS" },
  });
}
export function DELETE() {
  return new Response(null, {
    status: 405,
    headers: { ...responseHeaders(), Allow: "POST, OPTIONS" },
  });
}
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...responseHeaders(),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, MCP-Protocol-Version",
    },
  });
}
