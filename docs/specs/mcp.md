# Invoicey MCP

The shared MCP tools live in `packages/invoice-tools/src/register-mcp-tools.ts` and serve both
`apps/mcp/src/stdio.ts` and the authenticated `/api/mcp` route in the existing Vercel web app.
The remote transport uses the official SDK's stateless Streamable HTTP transport with JSON responses.

See [ChatGPT integration](chatgpt-integration.md) for architecture, OAuth, native UI and release acceptance;
see [the maintained tool reference](../../apps/web/content/docs/reference/mcp-tools.mdx) for contracts.

## Identity and workspace

- OAuth grants use S256 authorization code exchange, short-lived JWTs and refresh tokens.
  The consent reference binds a grant to a workspace; switching the web workspace does not redirect it.
- Personal API keys remain supported and follow the user's default workspace.
- Operations keys remain supported for the configured default workspace.
- User access checks current membership, role permissions, plan entitlements and workspace freeze state.
  UI visibility mirrors access; server checks remain authoritative.

## Tools and data

Draft creation uses the saved default issuer. Required invoice facts are typed; the model cannot
supply an issuer or preset ID. Updates preserve the seller. Issuing, sending and payment recording
have appropriate mutation/external-side-effect annotations and require explicit user intent.

Responses contain structured JSON plus text for clients without structured result support. PDF and ISDOC
binaries stay out of model context. Invoice reads return stored artifact URLs. Search supports pagination.
The remote server adds invoice resources, a drafting prompt, an MCP Apps interface and OpenAI Extensions mentions.

Presets use the configured file or database backend. Database operations stay scoped to the resolved workspace.
Historical import, recurring schedules, bank setup and payment reversal remain web-only.

## Compatibility

The remote server uses OAuth discovery at `/.well-known/oauth-protected-resource/api/mcp` and
`/.well-known/oauth-authorization-server/api/auth`. Human login remains Google/GitHub only.
Legacy OAuth tables are preserved by the additive provider migration. Existing personal-key clients
keep the `Authorization: Bearer ...` header and endpoint; they now enforce current workspace permissions.

MCP Apps renders the interface in supporting hosts. OpenAI navigation, mentions and model context
are feature-detected where needed. Private plugin creation does not imply public directory approval.
