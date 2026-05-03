# Handover — Plan 1 complete → Plan 2

## Phase status

**Plan 1 (repo bootstrap)** is **done** per [`docs/roadmap.md`](docs/roadmap.md): all exit criteria checked, timeline shows Plan 2 as **next**.

## What shipped

- **Monorepo:** Bun workspaces + Turborepo; scripts `bun dev` (web only), `bun build`, `bun lint`, `bun typecheck`, `bun db:push`.
- **`apps/web`:** Next.js 16 App Router, `(app)` sidebar shell + stub routes; Tailwind v4 + shadcn **base-nova**; [`components.json`](apps/web/components.json) registers `@reui`.
- **Packages:** `@invoicey/{invoice-core,db,ares}` placeholders + `config-ts` / `config-eslint`; Drizzle + Neon HTTP client; bootstrap table `bootstrap_probe`.
- **Tooling:** Husky + commitlint ([`commitlint.config.mjs`](commitlint.config.mjs)); Prettier + Tailwind plugin.
- **Env / DB:** [`packages/db/drizzle.config.ts`](packages/db/drizzle.config.ts) loads repo-root **`.env`** then **`.env.local`** so `bun db:push` works without exporting vars manually.

## Verification (next agent smoke test)

```bash
bun install
bun run typecheck && bun run lint && bun run build
bun dev
```

With **`DATABASE_URL`** set at repo root in `.env` or `.env.local`:

```bash
bun db:push
```

## Gotchas

1. **Next.js env:** App resolves env from **`apps/web/`**. When code starts importing `@invoicey/db` inside Next, duplicate **`DATABASE_URL`** into `apps/web/.env.local` (or equivalent); root `.env` alone does not load into Next automatically.
2. **`config-eslint`** package is a stub; real ESLint lives in `apps/web`.
3. Historical ADR **0002** title still says “Next.js 15”; runtime stack is **16** (living docs updated).

## Agent continuity

- **[`AGENTS.md`](AGENTS.md)** — durable prefs + workspace facts (continual-learning).
- **[`.cursor/hooks/state/continual-learning-index.json`](.cursor/hooks/state/continual-learning-index.json)** — transcript index for incremental memory updates.
- **Plan narrative:** [`.cursor/plans/plan-01-bootstrap.md`](.cursor/plans/plan-01-bootstrap.md) (done). Add **`plan-02-invoice-core.md`** when starting Plan 2 if you want the same pattern.

## Next phase — Plan 2 (`invoice-core`)

**Goal:** Pure domain in `packages/invoice-core` — Zod exports (`InvoiceSchema`, snapshots, items, totals), `calcTotals`, `nextInvoiceNumber`, `deriveStatus`, Vitest coverage per roadmap, CI running Vitest.

**Read first:** [`docs/domain/invoice-schema.md`](docs/domain/invoice-schema.md), [`docs/domain/vat-czech.md`](docs/domain/vat-czech.md), [`docs/domain/numbering.md`](docs/domain/numbering.md), [`docs/domain/status-engine.md`](docs/domain/status-engine.md).

**Roadmap:** [`docs/roadmap.md`](docs/roadmap.md) § Plan 2 (exit criteria list).

## Optional cleanup

- Remove `bootstrap_probe` once real migrations replace it (later plans).
- Wire Vitest at workspace root or package scope per roadmap (“Vitest runs in CI”).
