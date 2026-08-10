# Handover — MCP local + tools landed; Plan 5 issuers next

## Phase status

| Area | Status |
| --- | --- |
| Plans 0–4 (docs → ARES/clients) | Done |
| Plan 12a (local MCP + `/api/mcp` prep) | Done |
| Plan 13a (Slack stateless demo) | Done |
| **Plan 5 (issuers)** | **Next** on MVP track |
| Plans 6–9 | Planned (builder / list / dashboard / polish) |

Living ledger: [`docs/roadmap.md`](docs/roadmap.md). Repo overview: [`README.md`](README.md).

## What shipped recently (automation)

- **`@invoicey/invoice-tools`** — normalize draft, ARES lookup, create/render PDF+ISDOC, file presets, MCP registration (`@invoicey/invoice-tools/mcp`).
- **`apps/mcp`** — stdio MCP for Cursor (`bun run --cwd apps/mcp src/stdio.ts`).
- **`apps/web` `/api/mcp`** — `mcp-handler` + required `MCP_API_KEY` (Node, `maxDuration` 120).
- **Slack** — `/invoice` + `app_mention` use shared handlers via AI SDK wrappers.
- **Docs** — [`docs/specs/mcp.md`](docs/specs/mcp.md), README + architecture updated for new layout.
- **Cursor** — [`.cursor/mcp.json.example`](.cursor/mcp.json.example); local `.cursor/mcp.json` and `.invoicey/` are gitignored.

## Web demo (keep)

| Piece | Purpose |
| --- | --- |
| `/invoices/from-json` | Paste/edit invoice JSON, preview PDF |
| `POST /api/demo/invoice-pdf` | Server builds PDF from posted JSON |
| `apps/web/lib/demo-sample-invoice.json` | Realistic sample |

## Gotchas

1. PDF needs Node `Buffer` for images — never Edge for render routes.
2. Fonts: `outputFileTracingIncludes` in `apps/web/next.config.ts` for `invoice-core` assets.
3. Issuer on MCP/Slack is **locked** server-side (preset or `INVOICEY_DEMO_ISSUER_JSON`).
4. `IssuerSnapshotSchema` requires `contactEmail`.
5. Commit scopes include `invoice-tools` and `mcp` ([`commitlint.config.mjs`](commitlint.config.mjs)).

## Verification

```bash
bun install
bun run typecheck && bun run lint && bun run test && bun run build
```

## Next session — pick a track

**A — Plan 5 (issuers)**  
Follow [`docs/roadmap.md`](docs/roadmap.md) Plan 5 exit criteria (issuer CRUD, numbering editor, UploadThing when ready).

**B — MCP polish**  
More presets / templates, remote Vercel go-live when asked ([`docs/specs/mcp.md`](docs/specs/mcp.md)).

**C — PDF visuals**  
Iterate via `/invoices/from-json` + [`docs/specs/pdf-rendering.md`](docs/specs/pdf-rendering.md).

## Agent continuity

- [`AGENTS.md`](AGENTS.md) — prefs + workspace facts
- Plans: [`.cursor/plans/`](.cursor/plans/)
