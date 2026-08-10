# Plan 12a — Local MCP (Cursor-ready)

Maps to roadmap **Plan 12a**. Spec: [`docs/specs/mcp.md`](../../docs/specs/mcp.md).

## Goal

Working local MCP in Cursor: tools for `create_invoice`, `lookup_business`, and file-backed presets; shared `@invoicey/invoice-tools`; Vercel `/api/mcp` prepared with API-key gate (not deployed until asked).

## Exit criteria

- [x] `packages/invoice-tools` — normalize, demo issuer, ARES/create-render, presets + tests
- [x] `apps/mcp` stdio server registers tools via `@invoicey/invoice-tools/mcp`
- [x] Slack AI tools rewired to `@invoicey/invoice-tools`
- [x] `apps/web/app/api/[transport]/route.ts` — `mcp-handler` + `MCP_API_KEY`
- [x] Docs: `docs/specs/mcp.md`, roadmap/architecture updates, Cursor + Vercel go-live guide
- [ ] Manual Cursor smoke (enable MCP config, call tools) — operator step

## Notes

- Full persisted MCP tools (`list_invoices`, `mark_paid`, …) remain Plan 12b / post-MVP.
- Remote host is Vercel (same stack as `apps/web`), not Fly.io.
