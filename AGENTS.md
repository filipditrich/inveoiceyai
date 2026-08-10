## Learned User Preferences

- Capture product scope, specs, and architecture as maintained Markdown under `docs/` (split files, phased plans) instead of one giant in-chat plan.
- When executing an attached Cursor plan: do not modify the plan file; use existing todos only, mark items in progress, avoid creating duplicate todo lists.
- README and top-level docs should match the bar set by strong internal reference repos (clear structure, badges/navigation where appropriate).
- Solo workflow: no formal PR process; verify locally (e.g. `typecheck`, `lint`, `test`, `build`) then commit; prefer logically scoped conventional commits over one bulk “finalize” commit when splitting is natural.
- Prefer AI/MCP-driven invoice creation (validated `InvoiceSchema` JSON → PDF/ISDOC) over investing in a heavy invoice customization/builder UI; treat schema + tools as the primary create path.

## Learned Workspace Facts

- Root package name is `invoicey`; monorepo uses Bun workspaces and Turborepo (`apps/*`, `packages/*`).
- Phased delivery and per-phase status live in `docs/roadmap.md`, tied to entries under `.cursor/plans/` with explicit exit criteria checklists.
- Default web entry: `bun dev` runs `@invoicey/web` via Turbo; `bun db:push` runs Drizzle against `@invoicey/db`; `packages/db/drizzle.config.ts` loads repo-root `.env` then `.env.local` (override) so `DATABASE_URL` is available to `drizzle-kit` without manual `export`. Eager validated client is `@invoicey/db/client` (requires `@invoicey/env`); optional MCP path uses `tryCreateDbFromEnv()` from `@invoicey/db`. Seeded workspace UUID: `INVOICEY_DEFAULT_WORKSPACE_ID` / `DEFAULT_WORKSPACE_ID`. When Next.js imports `@invoicey/db/client`, put `DATABASE_URL` in `apps/web/.env.local` as well. Run `bun run test` at repo root for Vitest (Turbo).
- `apps/web/next.config.ts` loads repo-root `.env` then `.env.local` (via `dotenv`, with override on `.env.local`) before Next parses env — keeps `NEXT_PUBLIC_*` / `@invoicey/env` client validation aligned when canonical secrets live beside Drizzle at the repo root instead of under `apps/web/`.
- `apps/web` targets Next.js 16 and TypeScript 6 in living docs; some ADR titles may still say Next.js 15.
- Domain package `@invoicey/invoice-core`: subpath `@invoicey/invoice-core/schema` maps to `src/schema.ts` for client-safe Zod types; full package entry includes PDF/ISDOC/render code paths.
- `IssuerSnapshotSchema` requires `contactEmail` (trimmed valid email).
- Conventional-commit scopes are enforced via `commitlint.config.mjs` (includes `invoice-core`, `invoice-tools`, `mcp`, `web`, `docs`, `db`, `env`, `ares`, `deps`, `ci`, `config`, `release`).
- Stateless Slack POC (Plan 13a): slash command under `apps/web/app/api/slack/commands/` and `app_mention` Events API under `apps/web/app/api/slack/events/`; handlers live in `@invoicey/invoice-tools` (web wraps with AI SDK tools) and parse free-text NL via AI Gateway (`AI_GATEWAY_API_KEY`).
- MCP (Plan 12a): local stdio `@invoicey/mcp` (`apps/mcp`); shared registration `@invoicey/invoice-tools/mcp`; remote at `apps/web` `/api/mcp` via `mcp-handler` + required `MCP_API_KEY`. Presets: Neon when `DATABASE_URL` is set, else file (`INVOICEY_PRESETS_PATH`); force file with `INVOICEY_PRESETS_BACKEND=file`. See `docs/specs/mcp.md`, `docs/specs/db-schema.md`.
