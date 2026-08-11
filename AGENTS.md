## Learned User Preferences

- Capture product scope, specs, and architecture as maintained Markdown under `docs/` (split files, phased plans) instead of one giant in-chat plan.
- When executing an attached Cursor plan: do not modify the plan file; use existing todos only, mark items in progress, avoid creating duplicate todo lists.
- README and top-level docs should match the bar set by strong internal reference repos (clear structure, badges/navigation where appropriate).
- Solo workflow: no formal PR process; verify locally (e.g. `typecheck`, `lint`, `test`, `build`) then commit; prefer logically scoped conventional commits over one bulk “finalize” commit when splitting is natural.
- Prefer AI/MCP-driven invoice creation (validated `InvoiceSchema` JSON → PDF/ISDOC) over investing in a heavy invoice customization/builder UI; treat schema + tools as the primary create path.
- Prefer hosting remote MCP and Eve on the existing `@invoicey/web` Vercel app over separate hosts (e.g. Fly.io).
- Web auth is Better Auth OAuth-only (Google/GitHub); gate MCP/Eve with API keys. Prefer deepening account security (provider link/unlink, sessions/revoke, trusted devices) over reintroducing password auth.
- Before commit/PR on agent-written feature branches, run deslop (remove AI slop; keep behavior).
- For Eve/Slack agent invoice drafts: teach required schema fields in instructions, skills, and tool descriptions; do not silently default missing required fields in normalizers.
- Historical issued-invoice import is web bulk-only (no MCP/Slack tooling); track provenance/source (Invoicey version, fakturaonline, other Czech issuers, custom).
- Email From domain is `invoicey.ditrich.me` (not `mail.invoicey.ditrich.me`); invoice sends use a customizable display name like "Name via Invoicey".

## Learned Workspace Facts

- Root package name is `invoicey`; monorepo uses Bun workspaces and Turborepo (`apps/*`, `packages/*`). Phased delivery lives in `docs/roadmap.md`, tied to `.cursor/plans/` with exit-criteria checklists.
- Default web entry: `bun dev` runs `@invoicey/web` via Turbo; `bun db:push` runs Drizzle against `@invoicey/db`; `packages/db/drizzle.config.ts` and `apps/web/next.config.ts` load repo-root `.env` then `.env.local` (override). Eager DB client is `@invoicey/db/client` (requires `@invoicey/env`); optional MCP path uses `tryCreateDbFromEnv()`. Seeded workspace UUID: `INVOICEY_DEFAULT_WORKSPACE_ID` / `DEFAULT_WORKSPACE_ID`. Put `DATABASE_URL` in `apps/web/.env.local` when Next imports the client. Run `bun run test` at repo root (Vitest/Turbo).
- `apps/web` targets Next.js 16 and TypeScript 6 in living docs; some ADR titles may still say Next.js 15.
- Domain package `@invoicey/invoice-core`: subpath `@invoicey/invoice-core/schema` for client-safe Zod types; full entry includes PDF/ISDOC/render. `renderInvoicePdf` returns ISDOC.PDF (visual page + embedded `invoice.isdoc`, PDF/A-3b scaffolding); standalone `renderIsdoc` remains. `IssuerSnapshotSchema` requires `contactEmail`.
- Invoice lifecycle display (fakturaonline parity): `@invoicey/invoice-core/status-display` (`resolveDisplayStatus`; Future wins over Overdue); web filters/badges and MCP summaries use `displayStatus`. See `docs/domain/status-engine.md`.
- Conventional commits via `commitlint.config.mjs` (path scopes like `apps/web` / `packages/db`, short aliases, meta: `docs`, `deps`, `ci`, `config`, `release`, `git`, `security`, `i18n`). Husky: `commit-msg` → commitlint; `pre-commit` → lint-staged (Prettier; blocking `eslint --fix` for `apps`/`packages`); `pre-push` → `bun run typecheck`. Interactive commits: `bun run commit`. Bypass with `--no-verify` or `HUSKY=0` when needed. Releases: `semantic-release` on `main`.
- Web i18n: `next-intl` (not next-translate) with Czech-only MVP catalog `apps/web/locales/cs.json`, typed via `AppConfig` + `createMessagesDeclaration`. Docs are intentional EN; marketing/legal are mostly hardcoded Czech (not catalog); app chrome uses `t()`, but many app pages still mix EN/CS literals.
- Production host is `https://invoicey.ditrich.me` (Vercel project `inveoiceyai-web`): web app, remote MCP at `/api/mcp`, Eve at `/eve/v1/*`. Transactional email via Resend + `@invoicey/emails`; From domain is `invoicey.ditrich.me` (e.g. `invoices@invoicey.ditrich.me`).
- Better Auth (Plan 14): OAuth-only server in `apps/web/lib/auth/`; workspaces are Better Auth organizations (`session.activeOrganizationId` = `workspace_id`, ADR 0019). Builds that import auth need `BETTER_AUTH_SECRET` at build time.
- Eve Slack agent (Plan 13b): `apps/web/agent/` via `withEve()`; Connect Slack → `/eve/v1/slack` (`connectSlackCredentials("slack/invoicey")`); HTTP Bearer `EVE_API_KEY` or `MCP_API_KEY`. Tools wrap `@invoicey/invoice-tools` + `/ops`. Requires Node 24+ and `ai` ^7; prod needs `VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1`. Setup: `docs/specs/slack-eve.md`.
- MCP (Plan 12a/12b): local stdio `@invoicey/mcp`; shared registration `@invoicey/invoice-tools/mcp`; remote `/api/mcp` via `mcp-handler` + `MCP_API_KEY` (fails closed when unset). Presets: Neon when `DATABASE_URL` is set, else file (`INVOICEY_PRESETS_PATH`); force file with `INVOICEY_PRESETS_BACKEND=file`. Plan 12b: `list_invoices` / `get_invoice` / `mark_invoice_paid` with `status` + `displayStatus`. See `docs/specs/mcp.md`.
- UploadThing stores issuer assets and invoice PDF/ISDOC artifacts (`UPLOADTHING_TOKEN`). Issued invoices persist `pdf_url` / `isdoc_url` and should be served rather than regenerated; imports set `artifacts_immutable` + provenance (Plan 15, ADR 0021, `/invoices/import`).
