## Learned User Preferences

- Capture product scope, specs, and architecture as maintained Markdown under `docs/` (split files, phased plans) instead of one giant in-chat plan.
- When executing an attached Cursor plan: do not modify the plan file; use existing todos only, mark items in progress, avoid creating duplicate todo lists.
- README and top-level docs should match the bar set by strong internal reference repos (clear structure, badges/navigation where appropriate).
- Solo workflow: no formal PR process; verify locally (e.g. `typecheck`, `lint`, `test`, `build`) then commit; prefer logically scoped conventional commits over one bulk “finalize” commit when splitting is natural.

## Learned Workspace Facts

- Root package name is `invoicey`; monorepo uses Bun workspaces and Turborepo (`apps/*`, `packages/*`).
- Phased delivery and per-phase status live in `docs/roadmap.md`, tied to entries under `.cursor/plans/` with explicit exit criteria checklists.
- Default web entry: `bun dev` runs `@invoicey/web` via Turbo; `bun db:push` runs Drizzle against `@invoicey/db`; `packages/db/drizzle.config.ts` loads repo-root `.env` then `.env.local` (override) so `DATABASE_URL` is available to `drizzle-kit` without manual `export`. When Next.js imports `@invoicey/db`, put `DATABASE_URL` in `apps/web/.env.local` as well. Run `bun run test` at repo root for Vitest (Turbo).
- `apps/web` targets Next.js 16 and TypeScript 6 in living docs; some ADR titles may still say Next.js 15.
- Domain package `@invoicey/invoice-core`: subpath `@invoicey/invoice-core/schema` maps to `src/schema.ts` for client-safe Zod types; full package entry includes PDF/ISDOC/render code paths.
- `IssuerSnapshotSchema` requires `contactEmail` (trimmed valid email).
- Conventional-commit scopes are enforced via `commitlint.config.mjs` (includes `invoice-core`, `web`, `docs`, `db`, `ares`, `deps`, `ci`, `config`, `release`).
