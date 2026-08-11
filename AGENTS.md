## Learned User Preferences

- Capture product scope, specs, and architecture as maintained Markdown under `docs/` (split files, phased plans) instead of one giant in-chat plan.
- When executing an attached Cursor plan: do not modify the plan file; use existing todos only, mark items in progress, avoid creating duplicate todo lists.
- README and top-level docs should match the bar set by strong internal reference repos (clear structure, badges/navigation where appropriate).
- Solo workflow: no formal PR process; verify locally (e.g. `typecheck`, `lint`, `test`, `build`) then commit; prefer logically scoped conventional commits over one bulk “finalize” commit when splitting is natural.
- Prefer AI/MCP-driven invoice creation (validated `InvoiceSchema` JSON → PDF/ISDOC) over investing in a heavy invoice customization/builder UI; treat schema + tools as the primary create path.
- Prefer hosting remote MCP and Eve on the existing `@invoicey/web` Vercel app over separate hosts (e.g. Fly.io).
- Defer multi-user auth for now: single-tenant open web demo; gate MCP/Eve with API keys only.
- Before commit/PR on agent-written feature branches, run deslop (remove AI slop; keep behavior).
- For Eve/Slack agent invoice drafts: teach required schema fields in instructions, skills, and tool descriptions; do not silently default missing required fields in normalizers.

## Learned Workspace Facts

- Root package name is `invoicey`; monorepo uses Bun workspaces and Turborepo (`apps/*`, `packages/*`).
- Phased delivery and per-phase status live in `docs/roadmap.md`, tied to entries under `.cursor/plans/` with explicit exit criteria checklists.
- Default web entry: `bun dev` runs `@invoicey/web` via Turbo; `bun db:push` runs Drizzle against `@invoicey/db`; `packages/db/drizzle.config.ts` loads repo-root `.env` then `.env.local` (override) so `DATABASE_URL` is available to `drizzle-kit` without manual `export`. Eager validated client is `@invoicey/db/client` (requires `@invoicey/env`); optional MCP path uses `tryCreateDbFromEnv()` from `@invoicey/db`. Seeded workspace UUID: `INVOICEY_DEFAULT_WORKSPACE_ID` / `DEFAULT_WORKSPACE_ID`. When Next.js imports `@invoicey/db/client`, put `DATABASE_URL` in `apps/web/.env.local` as well. Run `bun run test` at repo root for Vitest (Turbo).
- `apps/web/next.config.ts` loads repo-root `.env` then `.env.local` (via `dotenv`, with override on `.env.local`) before Next parses env — keeps `NEXT_PUBLIC_*` / `@invoicey/env` client validation aligned when canonical secrets live beside Drizzle at the repo root instead of under `apps/web/`.
- `apps/web` targets Next.js 16 and TypeScript 6 in living docs; some ADR titles may still say Next.js 15.
- Domain package `@invoicey/invoice-core`: subpath `@invoicey/invoice-core/schema` maps to `src/schema.ts` for client-safe Zod types; full package entry includes PDF/ISDOC/render code paths. `renderInvoicePdf` returns ISDOC.PDF (visual page + embedded `invoice.isdoc`, PDF/A-3b scaffolding); standalone `renderIsdoc` remains available.
- `IssuerSnapshotSchema` requires `contactEmail` (trimmed valid email).
- Invoice lifecycle display (fakturaonline parity): `@invoicey/invoice-core/status-display` (`resolveDisplayStatus`; Future wins over Overdue); web list/dashboard filters and badges use display status; MCP invoice summaries include `displayStatus`. See `docs/domain/status-engine.md`.
- Conventional-commit scopes are enforced via `commitlint.config.mjs` (includes `invoice-core`, `invoice-tools`, `mcp`, `web`, `docs`, `db`, `env`, `ares`, `deps`, `ci`, `config`, `release`).
- Production host is `https://invoicey.ditrich.me` (Vercel project `inveoiceyai-web`): web app, remote MCP at `/api/mcp`, Eve at `/eve/v1/*`.
- Eve Slack agent (Plan 13b): `apps/web/agent/` mounted with `withEve()` in `apps/web/next.config.ts`; Connect Slack → `/eve/v1/slack` (`connectSlackCredentials("slack/invoicey")`); HTTP channel Bearer `EVE_API_KEY` or `MCP_API_KEY`. Tools wrap `@invoicey/invoice-tools` + `/ops` (HITL issue/mark paid). Requires Node 24+ and `ai` ^7 (Eve peer). Prod builds need `VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1`. Setup: `docs/specs/slack-eve.md`. Plan 13a `/api/slack/*` retired (historical: `docs/specs/slack-bot.md`).
- MCP (Plan 12a/12b): local stdio `@invoicey/mcp` (`apps/mcp`); shared registration `@invoicey/invoice-tools/mcp`; remote at `apps/web` `/api/mcp` via `mcp-handler` + `MCP_API_KEY` bearer (optional in the env schema; the route fails closed when unset). Presets: Neon when `DATABASE_URL` is set, else file (`INVOICEY_PRESETS_PATH`); force file with `INVOICEY_PRESETS_BACKEND=file`. Plan 12b adds `list_invoices` / `get_invoice` / `mark_invoice_paid` with `status` + `displayStatus` on summaries. See `docs/specs/mcp.md`, `docs/specs/db-schema.md`.
