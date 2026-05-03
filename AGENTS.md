## Learned User Preferences

- Capture product scope, specs, and architecture as maintained Markdown under `docs/` (split files, phased plans) instead of one giant in-chat plan.
- When executing an attached Cursor plan: do not modify the plan file; use existing todos only, mark items in progress, avoid creating duplicate todo lists.
- README and top-level docs should match the bar set by strong internal reference repos (clear structure, badges/navigation where appropriate).

## Learned Workspace Facts

- Root package name is `invoicey`; monorepo uses Bun workspaces and Turborepo (`apps/*`, `packages/*`).
- Phased delivery and per-phase status live in `docs/roadmap.md`, tied to entries under `.cursor/plans/` with explicit exit criteria checklists.
- Default web entry: `bun dev` runs `@invoicey/web` via Turbo; database workflows use `bun db:push` on `@invoicey/db` (Drizzle + Neon). Domain package: `@invoicey/invoice-core`; run `bun run test` at repo root for Vitest (Turbo).
