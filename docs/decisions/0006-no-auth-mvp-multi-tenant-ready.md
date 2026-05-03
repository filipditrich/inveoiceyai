# 0006: No auth in MVP, but the schema is multi-tenant-ready from day 1

## Status

Accepted (Phase 0, 2026-05-03)

## Context

The product has three target use cases (see [`PRD.md`](../PRD.md)):

- UC1 — personal invoicing (single user, possibly multiple issuer businesses)
- UC2 — OBO/self-billing (still a single user)
- UC3 — intra-company invoicing from Slack (multi-user, post-MVP)

UC1 and UC2 do not need authentication; they're a personal tool running on a private URL or behind a reverse-proxy basic-auth gate. UC3 needs proper auth + multi-user, and that means workspaces with memberships.

Options:

1. **No auth, single-tenant data model**, refactor to multi-tenant when UC3 lands → migration touches every table, every query, every server action. High-risk later refactor.
2. **No auth, multi-tenant data model from day 1** (one default workspace, hard-coded) → small upfront cost, zero refactor when auth lands.
3. **Auth from day 1** (Clerk) → friction for the personal-use case; over-engineering before product validation.

Forces:

- Adding `workspace_id` to every table is cheap on day 1, expensive on day 100
- Auth is genuinely not needed for UC1/UC2 yet; introducing it now would slow the personal use case
- Clerk integrates trivially via Vercel Marketplace when we want it (post-MVP, Plan 14)

## Decision

The MVP runs **without authentication**, with a **multi-tenant-ready schema** that already includes `workspace_id` on every business-data table. One workspace row is seeded at deploy time and its UUID lives in `INVOICEY_DEFAULT_WORKSPACE_ID` env var.

Specifically:

- All `*_businesses`, `invoices`, `invoice_items`, `numbering_schemes` rows carry `workspace_id` (foreign key to `workspaces`)
- Every server query includes `WHERE workspace_id = $WORKSPACE_ID`
- The workspace ID is read once at server startup from `INVOICEY_DEFAULT_WORKSPACE_ID`; no dynamic resolution in MVP
- No `users` table in MVP; no `workspace_memberships`
- The Next.js app does **not** put a login screen between the visitor and the data; deployment-level access control (Vercel Password Protection, basic auth, IP allowlist) is the recommendation

When [Plan 14 (auth)](../roadmap.md) lands:

- Add `users` and `workspace_memberships` tables
- Replace the `INVOICEY_DEFAULT_WORKSPACE_ID` constant with a session-derived value (Clerk org → workspace mapping)
- No data migration needed — existing rows stay under the seeded workspace; new users get added as members of it

## Consequences

### Positive

- Zero auth friction for personal use; the tool is usable behind any reverse proxy you trust
- Adding multi-user is a feature addition, not a refactor
- Slack/MCP rollouts (Plans 12, 13) consume the same workspace seam — they use a "service identity" that's mapped to the default workspace until Plan 14

### Negative

- The MVP needs deployment-level access control to be safe on the public internet — documented in `architecture.md`
- "Single-user" UX assumptions are baked into a couple of places (no "switch user" menu, no "shared with you" UX, no audit trail of who-did-what); these surfaces will need polish in Plan 14
- A user who deploys without reading the docs could expose their invoices publicly. The README will be loud about this.

### Neutral

- Clerk is the planned auth provider but not committed; the schema is provider-agnostic. Auth0, Better-Auth, or self-rolled magic-link are equally implementable in Plan 14.

## Plans touched

- Plan 1 (bootstrap) — adds `workspace_id` to every table, sets up `INVOICEY_DEFAULT_WORKSPACE_ID`
- Plan 14 (auth, post-MVP) — flips the workspace-id source from env-var to session

## References

- [`architecture.md`](../architecture.md) (env-vars table)
- [ADR 0007](./0007-workspace-scoped-data-model.md) (the workspace scoping convention)
