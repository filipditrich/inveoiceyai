# Plan 01 — Repo bootstrap

**Roadmap:** [Plan 1 in docs/roadmap.md](../docs/roadmap.md)

## Doc inputs

- [`docs/architecture.md`](../docs/architecture.md)
- ADRs [0001](../docs/decisions/0001-monorepo-turborepo-bun.md), [0002](../docs/decisions/0002-nextjs15-app-router.md), [0003](../docs/decisions/0003-shadcn-plus-reui-registry.md), [0009](../docs/decisions/0009-drizzle-neon-postgres.md)

## Execution order

1. Root Turborepo + Bun workspaces; placeholder packages under `packages/*`.
2. `apps/web` — Next.js 15 App Router, `(app)` group with sidebar shell.
3. `packages/db` — Drizzle + Neon-compatible URL; `drizzle/` migrations folder committed; `bun db:push`.
4. Tailwind v4 + `shadcn` init + `components.json` `registries.@reui` (`base-nova`).
5. `commitlint` + Husky `commit-msg`; `.env.example` at repo root.

## Verification

- `bun install`, `bun dev`, `bun db:push` (valid `DATABASE_URL`), invalid commit message rejected.
