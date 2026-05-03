# 0001: Monorepo with Turborepo + bun workspaces

## Status

Accepted (Phase 0, 2026-05-03)

## Context

Invoicey will eventually grow several deployable apps that share domain logic:

- `apps/web` — the Next.js admin app (MVP)
- `apps/mcp` — an MCP server (post-MVP, Plan 12)
- `apps/slack` — a Slack bot (post-MVP, Plan 13)

All three need to call the same invoice domain logic (`InvoiceSchema`, `calcTotals`, PDF/QR/ISDOC rendering) and the same DB layer. The choice is between:

1. **Single-app repo with internal modules**, then later extract — cheap now, expensive when extraction happens
2. **Polyrepo (separate repos per app + a shared package via npm)** — slow iteration, every cross-app change needs a publish-and-bump cycle
3. **Monorepo from day 1** — one repo, one PR for cross-app changes, internal packages consumed by relative imports

Forces:

- The shared domain (`@invoicey/invoice-core`) will see significant churn during MVP — fast iteration matters more than independent versioning
- The author works alone for now; coordination overhead of polyrepo would land on one person
- Vercel handles monorepo deploys cleanly via the `rootDirectory` setting
- Bun is the team's default package manager (per `.cursor/rules/package-management.mdc`); no `pnpm-lock.yaml` exists in this repo so bun stays the choice

Tooling options for the monorepo itself:

- **Turborepo** — task orchestration + caching, well-supported by Vercel, minimal config
- **Nx** — more features, more complexity, more opinions
- **No build orchestrator** — just bun workspaces — fine until builds get slow or CI needs caching

## Decision

We use a **Turborepo monorepo** with **bun workspaces** as the package manager. Layout is the one in [`architecture.md`](../architecture.md).

Specifically:

- `package.json` at root declares `workspaces: ["apps/*", "packages/*"]`
- Bun is the package manager; `bun.lockb` is committed; `bun install` is the canonical install command
- Turborepo orchestrates `dev`, `build`, `lint`, `test`, `type-check` with caching
- Internal packages are referenced as `@invoicey/<name>` and resolved via workspace protocol (`"@invoicey/invoice-core": "workspace:*"`)

## Consequences

### Positive

- Cross-app refactors are one PR, one CI run, one merge
- The shared domain package is consumed by relative resolution — no publish step
- Type-checking flows across packages in IDE without setup
- Bun + Turborepo gives fast cold installs and incremental builds

### Negative

- Every contributor needs Bun installed (the project's default already, so this is moot for now)
- Vercel project settings must be configured per-app (root directory + framework detection)
- Tests against a real Neon DB need to run from within a workspace — slightly more ceremony than a single-app repo

### Neutral

- We commit to internal-package versioning conventions later (probably "always-bump-together"; no published packages)
- ESM-only inside packages; no CJS interop needed since Next.js + bun both handle ESM natively

## Plans touched

- Plan 1 (repo bootstrap) — primary implementation
- Every later plan implicitly relies on this layout

## References

- [Turborepo docs](https://turborepo.com/docs)
- [Bun workspaces](https://bun.sh/docs/install/workspaces)
- Workspace rule: `.cursor/rules/package-management.mdc`
