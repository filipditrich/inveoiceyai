# 0007: Workspace-scoped data model (every business-data row carries `workspace_id`)

## Status

Accepted (Phase 0, 2026-05-03)

## Context

Per [ADR 0006](./0006-no-auth-mvp-multi-tenant-ready.md), the MVP has no authentication but the data model must be ready for multi-user / multi-team future. The decision space:

1. **No tenancy column** in MVP, add it in Plan 14 → painful migration touching every table, query, and index
2. **`workspace_id` on every business-data row from day 1** → uniform scoping convention, indexes ready, queries ready
3. **`user_id` on every row** → couples ownership to a single user, doesn't model team scenarios (UC3 — Slack from a team)

Forces:

- The Slack use case (UC3) is fundamentally team-shaped: many users, one shared invoicing context
- A workspace is the natural unit of "shared data": businesses, clients, invoices, numbering schemes are all scoped to a workspace
- A workspace is also the natural billing/permissioning unit when SaaS or auth lands
- Indexes on `(workspace_id, …)` are nearly free now; adding `workspace_id` later means re-creating every multi-column index

## Decision

Every table that holds business data carries a non-nullable `workspace_id uuid` foreign key referencing `workspaces.id`.

Tables:

- `workspaces` — id, name, created_at
- `issuer_businesses` — `workspace_id` + own fields
- `client_businesses` — `workspace_id` + own fields
- `issuer_numbering_schemes` — `workspace_id` + `issuer_id` + own fields
- `invoices` — `workspace_id` + `issuer_id` + `client_id` + own fields
- `invoice_items` — _no_ direct `workspace_id` — they FK to `invoices` which carries it (kept normalized)

Conventions:

- Every multi-column index starts with `workspace_id` (e.g. `idx_invoices_workspace_due (workspace_id, due_date)`)
- Every server query includes `WHERE workspace_id = $X`. We codify this via a helper `eq(table.workspaceId, $X)` injected into a base query in `@invoicey/db`
- Application-level validation is the only enforcement of "data from workspace A never leaks to a request from workspace B"; we deliberately do not use Postgres RLS in MVP (overkill for one workspace, premature complexity)

When auth lands (Plan 14), `users` and `workspace_memberships` are introduced and `workspace_id` is derived from `session.activeWorkspaceId`. No table migration; only query-helper updates.

## Consequences

### Positive

- Zero refactor when auth lands
- Every query is naturally scoped — no "global table" footguns
- Indexes are tuned for the eventual multi-tenant query patterns
- We can spin up multiple workspaces via SQL alone for testing or staging environments

### Negative

- Boilerplate on every query: `where workspaceId equals X`. Mitigated by a base-query helper.
- A single missed `WHERE workspace_id = …` is a tenant-leak bug. Mitigated by the helper being the _only_ sanctioned way to start a query, and by tests that grep for raw queries
- Slight over-engineering for the single-workspace MVP; explicit cost we accept

### Neutral

- We do not use Postgres RLS in MVP. If we ever go multi-tenant SaaS, we add RLS as an additional layer (defense in depth) — not a replacement for the helper.

## Plans touched

- Plan 1 (bootstrap) — sets up `workspaces`, seeds the default row, adds `workspace_id` columns
- Every later plan implicitly relies on this scoping convention

## References

- [ADR 0006 — no auth in MVP](./0006-no-auth-mvp-multi-tenant-ready.md)
- [`architecture.md`](../architecture.md) — env vars (the seed workspace ID lives in `INVOICEY_DEFAULT_WORKSPACE_ID`)
