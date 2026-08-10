# MCP server — local stdio + Vercel HTTP (Plan 12a)

## Goal

Expose invoice create/render, ARES lookup, and local presets as MCP tools so Cursor (and later remote clients) can drive `InvoiceSchema` → PDF/ISDOC without a heavy builder UI.

## Inputs / outputs

| Tool | Input | Output |
| --- | --- | --- |
| `lookup_business` | `{ ico }` | ARES draft client fields or error |
| `create_invoice` | `{ draft?, issuerPresetId?, templatePresetId? }` | Validated invoice + PDF base64 + ISDOC XML, or issues |
| `list_presets` / `get_preset` / `save_preset` / `delete_preset` | preset ids / kind / data | Preset records on disk |

Shared logic: [`@invoicey/invoice-tools`](../../packages/invoice-tools/). Registration: [`registerInvoiceyMcpTools`](../../packages/invoice-tools/src/register-mcp-tools.ts).

## Approach

```mermaid
flowchart LR
  CursorLocal["Cursor"] -->|"stdio"| McpApp["apps/mcp stdio"]
  CursorRemote["Cursor remote"] -->|"Streamable HTTP"| ApiMcp["apps/web /api/mcp"]
  McpApp --> Tools["@invoicey/invoice-tools"]
  ApiMcp --> Tools
  Tools --> Core["invoice-core"]
  Tools --> Ares["ares"]
  Tools --> Presets["presets.json"]
```

- **Local:** `apps/mcp` + `@modelcontextprotocol/sdk` stdio (`bun run --cwd apps/mcp src/stdio.ts`).
- **Remote (prepared):** `mcp-handler` on [`apps/web/app/api/[transport]/route.ts`](../../apps/web/app/api/[transport]/route.ts) → URL `/api/mcp`. Node runtime, `maxDuration` 120. When `MCP_API_KEY` is set, require `Authorization: Bearer <key>`.
- **Issuer lock:** `create_invoice` injects issuer from preset or `getDemoIssuer()` / `INVOICEY_DEMO_ISSUER_JSON`.
- **Presets file:** `INVOICEY_PRESETS_PATH` or `~/.invoicey/presets.json` (on Vercel: `/tmp/invoicey-presets.json` — ephemeral).

## Cursor local setup

Project or user MCP config:

```json
{
  "mcpServers": {
    "invoicey": {
      "command": "bun",
      "args": [
        "run",
        "--cwd",
        "/ABS/PATH/inveoiceyai/apps/mcp",
        "src/stdio.ts"
      ],
      "env": {
        "INVOICEY_PRESETS_PATH": "/ABS/PATH/.invoicey/presets.json"
      }
    }
  }
}
```

Optional seed: copy [`apps/mcp/presets.example.json`](../../apps/mcp/presets.example.json) to your presets path.

Example also lives at [`.cursor/mcp.json.example`](../../.cursor/mcp.json.example).

## Vercel go-live checklist (do not deploy until asked)

1. Deploy `apps/web` (includes `/api/mcp` via `[transport]` route).
2. Set Vercel env: `MCP_API_KEY` (required in prod), optional `INVOICEY_DEMO_ISSUER_JSON`.
3. Confirm Node runtime + font tracing (`outputFileTracingIncludes` in `next.config.ts`).
4. Cursor remote config:

```json
{
  "mcpServers": {
    "invoicey-remote": {
      "url": "https://<your-web>.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_API_KEY>"
      }
    }
  }
}
```

5. Smoke: `lookup_business` with a real IČO, then `create_invoice` with a minimal draft.

## Env

| Var | Required | Notes |
| --- | --- | --- |
| `INVOICEY_DEMO_ISSUER_JSON` | no | Full `IssuerSnapshot` JSON override |
| `INVOICEY_PRESETS_PATH` | no | Absolute path to presets JSON |
| `MCP_API_KEY` | remote yes | Bearer gate for `/api/mcp` |

## Out of scope (later Plan 12b)

- DB-backed `list_invoices` / `get_invoice` / `mark_paid`
- Durable remote presets (Blob/DB)
- OAuth / Clerk (Plan 14)

## References

- [`docs/roadmap.md`](../roadmap.md) Plan 12a
- [`.cursor/plans/plan-12-mcp-local.md`](../../.cursor/plans/plan-12-mcp-local.md)
- Slack tool surface (same handlers): [`docs/specs/slack-bot.md`](./slack-bot.md)
- [Vercel MCP deploy docs](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel)
- [`mcp-handler`](https://github.com/vercel/mcp-handler)
