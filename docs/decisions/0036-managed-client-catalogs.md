# 0036: Managed client catalogs sync into workspaces, not across them

## Status

Accepted (2026-08-27)

## Context

A sponsored plan must constrain _who_ a workspace may invoice. NFCtron
contractors get an Invoicey workspace to bill NFCtron a.s., NFCtron Pay a.s.,
and NFCtron Marketing s.r.o. — and nobody else, so the sponsorship does not
become a free general-purpose invoicing account for their other clients.

Clients are workspace-scoped rows (`clients.workspace_id`, snapshot jsonb,
deduped by normalized IČO). Invoices snapshot the client at issue time
(ADR 0008), so an invoice never depends on the client row after issue.

Two shapes were available: a cross-workspace registry the plan points at, or a
per-plan catalog that materializes into each workspace.

## Decision

1. The catalog is a **`plan_clients`** table, unique on `(plan_id, ico)`, with
   the same snapshot shape as `clients.snapshot`. Rows are seeded from ARES by
   IČO.
2. Catalog rows **sync into** each granted workspace as ordinary `clients` rows,
   upserted on normalized IČO via the existing `clients_workspace_ico_uidx`
   identity, and marked with `clients.plan_client_id`.
3. The constraint is an entitlement, not a plan special case:
   `entitlements.clients.createMode: "open" | "managed"`. Any plan can be
   configured `managed`; Enterprise is expected to use it too.
4. Under `managed`, client create / edit / delete are blocked on **every**
   surface — web form, ARES lookup, import, MCP, Eve/Slack — and the invoice
   client picker offers only rows with a non-null `plan_client_id`.
5. Removing a catalog row, or moving a workspace off the plan, **clears
   `plan_client_id` and leaves the client row in place**. Nothing is deleted.

## Consequences

- No query anywhere gains a cross-tenant join or a new tenancy exception, which
  is the property that matters most — the whole reason contractors get separate
  workspaces is that no one may see another's data.
- Adding a fourth NFCtron entity is one catalog row plus a sync; it appears in
  all granted workspaces.
- Each workspace carries duplicate client rows for the same counterparty. That
  is accepted: it is a handful of rows, and it keeps snapshots, dedup, and
  invoice rendering unchanged.
- Catalog edits must re-sync. A stale copy in one workspace is a silent
  correctness bug, so sync runs on every catalog write and on plan assignment.
- Revocation is non-destructive and reversible: the client rows survive as
  ordinary editable clients.

## Alternatives considered

**Global `managed_clients` table read cross-workspace at query time.** Rejected
— every client list, picker, invoice form, and agent tool would need a union and
a tenancy exception, and the isolation guarantee gets weaker with each one.

**Per-member client allowlists (resource scoping).** Rejected for v1 — roughly
5× the work (every list query, detail route, and agent tool path scoped per
actor) and unnecessary once each contractor has their own single-member
workspace. Revisit only if a real multi-member customer needs subsets.

**Block at issue time by IČO allowlist, leave client creation open.** Rejected —
the user only discovers the constraint after doing the work, and drafts, AI
prompts, and Slack flows would all produce dead ends.

## Plans touched

- Plan 26 — Plans, entitlements, and workspace permissions

## References

- [ADR 0008](./0008-snapshot-issuer-client-at-issue-time.md)
- [ADR 0035](./0035-plans-are-shared-entitlement-rows.md)
- [docs/specs/plans-entitlements.md](../specs/plans-entitlements.md)
- [docs/specs/ares.md](../specs/ares.md)
