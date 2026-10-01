import { MCP_ISSUER, MCP_RESOURCE, MCP_SCOPES } from "@/lib/mcp/config";
export function GET() {
  return Response.json(
    {
      resource: MCP_RESOURCE,
      authorization_servers: [MCP_ISSUER],
      scopes_supported: MCP_SCOPES,
      bearer_methods_supported: ["header"],
      resource_name: "Invoicey",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
