# 0014: Invoice status is derived, not stored

## Status

Accepted (Phase 0, 2026-05-03)

## Context

An invoice's lifecycle has five named states: `draft`, `issued`, `overdue`, `paid`, `cancelled` (see [`status-engine.md`](../domain/status-engine.md)). The question is whether to **store** the current status in a column or **compute** it from underlying facts.

Options:

1. **Store as a `status` column** — simplest queries (`WHERE status = 'overdue'`), but requires a job to flip `issued → overdue` at midnight
2. **Derive at read time from `(issued_at, paid_at, due_date, cancelled_at, now())`** — no clock-tick job; `overdue` is derived from `due_date < now`
3. **Store + periodically rederive** — both costs

Forces:

- "Overdue" is a function of *time passing*, not of any user action — there's no event when an invoice becomes overdue, just a clock crossing the due date
- A daily cron is operational overhead with timezone gotchas
- Status filters in the data grid (Plan 7) need SQL-level support — a derived status must be expressible as SQL, not just as TypeScript
- Postgres can compute `due_date < (now() AT TIME ZONE 'Europe/Prague')::date` cheaply with the right index

## Decision

Status is **derived**, not stored. The invoice row stores only the underlying facts:

- `issued_at` (nullable; null = draft)
- `paid_at` (nullable; null = unpaid)
- `cancelled_at` (nullable; null = not cancelled)
- `due_date` (always present once issued; serves as the cutoff for overdue)

The derivation is implemented twice — once in TypeScript for in-memory rows (`deriveStatus`), once in SQL for filterable queries (`whereStatusIs(status)` query helper). Both consult the same authoritative rules from [`status-engine.md`](../domain/status-engine.md).

## Consequences

### Positive

- No periodic "tick" job needed
- Status is always consistent — there's never a window where the DB says `issued` and a request handler computes `overdue`
- "Mark paid" / "Cancel" is a single column update, not a status-machine transition
- Adding new derived classifications (e.g. "upcoming due ≤ 14 days") is a pure-function addition

### Negative

- Two implementations of the rules (TS + SQL); they must stay in sync. Mitigated by tests that exercise both with the same fixtures.
- Status-driven indexes are slightly more complex (partial indexes filtered on null-ness of the timestamps; see `status-engine.md`)
- `WHERE status = 'overdue'` is more verbose in SQL than a direct equality

### Neutral

- We do not surface a "status changed at" timestamp; the closest events (issued/paid/cancelled) are timestamps in their own right and tell the same story
- For the data grid, we project the derived status as a virtual column in the SELECT for the response payload (just so the client doesn't recompute it)

## Plans touched

- Plan 2 (`invoice-core`) — pure `deriveStatus` function + tests
- Plan 7 (invoice list) — SQL helpers + indexes
- Plan 8 (dashboard) — derived "upcoming due"

## References

- [`status-engine.md`](../domain/status-engine.md) — full state diagram, transitions, SQL mappings
