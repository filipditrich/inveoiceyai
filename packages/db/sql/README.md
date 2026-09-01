# Applied DDL records

The repo is **push-only** — `drizzle-kit push` diffs `src/schema.ts` against the
live database and there are no generated migration files, so ordinarily nothing
records _what was actually run_. These files do.

They are not run automatically and drizzle-kit does not read them. Each is
idempotent (`IF NOT EXISTS`, `DO $$ … EXCEPTION WHEN duplicate_object`), so
re-running one is a no-op.

## Why these exist

`bun db:push` **could not be run unattended on this database.** The two false
positives below were fixed on 2026-08-26 by
`2026-08-26-unique-constraints-to-indexes.sql` — drizzle-kit does not match
composite `unique(name).on(a, b)` against what it introspects, but does match
`uniqueIndex()`, so the schema now uses the latter throughout. Push no longer
offers to truncate anything.

The last genuine drift — `clients_workspace_ico_uidx` could not be created
while duplicate clients existed — was cleared on 2026-08-26 by finally applying
`2026-08-15-client-identity-dedup.sql`. The duplicates were three identical
`NFCtron a.s.` rows and two identical `NFCtron Pay a.s.` rows in the seed
workspace, created seconds apart by repeated ARES lookups. None carried an
invoice, so nothing was repointed; the rows holding all 97 real invoices live in
a different workspace and were never duplicates.

**`bun db:push` now runs clean.** Keep it that way: prefer `uniqueIndex()` over
`unique()` for anything composite, and let `.unique()` name itself rather than
pinning a Postgres-generated name.

Historically: On the Plan 14
schema it twice offered to _truncate a table containing production rows_:

- adding `workspaces.slug` as `NOT NULL UNIQUE` to a table with 1 row →
  "Do you want to truncate workspaces table?"
- re-proposing `invoices_issuer_number`, a unique constraint that **already
  exists** in the database (a drizzle-kit false positive) →
  "Do you want to truncate invoices table?"

Answering yes to either would destroy data. drizzle-kit also refuses to run
non-interactively, so it cannot be scripted safely.

## Procedure for future schema changes

1. Edit `src/schema.ts`.
2. Preview the SQL:
   `bunx drizzle-kit generate --schema ./src/schema.ts --dialect postgresql --out /tmp/preview`
3. Read the diff. Keep only additive statements; make them idempotent.
4. Record the result here, dated, and apply it.
5. Verify with `bun run --cwd packages/db scripts/row-counts.ts` before and
   after — row counts must match unless the change intends otherwise.
6. Before deploying the matching web build, run
   `bun run --cwd apps/web check:runtime-schema` against the target database.

Split anything that adds a `NOT NULL UNIQUE` column to a populated table into
two steps (add nullable + backfill, then tighten), as
`2026-08-11-plan14-workspace-slug.sql` does.

## Recorded files

| File                                                  | Plan                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `2026-08-11-plan14-*.sql`                             | Plan 14 auth / workspaces                                                          |
| `2026-08-11-plan16-account-security.sql`              | Plan 16 trusted devices + audit                                                    |
| `2026-08-11-plan19-invites-referrals.sql`             | Plan 19 referral columns + `referral_events`                                       |
| `2026-08-12-ai-token-usage.sql`                       | Plan 21 AI token balances + usage                                                  |
| `2026-08-12-plan10-recurring.sql`                     | Plan 10 templates + recurring schedules                                            |
| `2026-08-13-default-issuer.sql`                       | `issuer_businesses.is_default`                                                     |
| `2026-08-13-issued-artifact-hashes.sql`               | Immutable issued artifact SHA-256 metadata                                         |
| `2026-08-15-plan22-payments-fio.sql`                  | Payment ledger + Fio read-only integration                                         |
| `2026-08-15-invoice-payment-identifiers-backfill.sql` | Repair web-issued invoice matching identifiers                                     |
| `2026-08-15-fio-auto-match.sql`                       | Opt-in exact Fio payment auto-matching                                             |
| `2026-08-15-moneta-provider.sql`                      | Allow `moneta` on `bank_connections.provider`                                      |
| `2026-08-15-client-identity-dedup.sql`                | Client cleanup + identity uniqueness indexes                                       |
| `2026-08-26-drop-incoming-invoices.sql`               | Removed the incoming-invoices / payables domain                                    |
| `2026-08-26-unique-constraints-to-indexes.sql`        | Fixed the drizzle-kit drift that made `db:push` offer to truncate populated tables |
| `2026-08-31-plan27-pdf-looks.sql`                     | Plan 27 S0 — workspace default look, invoice look columns, `looks.apply` backfill  |
| `2026-08-31-plan28-workspace-looks.sql`               | Plan 28 S1 — `workspace_looks` versioned documents                                 |
| `2026-08-31-plan29-community-looks.sql`               | Plan 29 S2 — `community_looks` published catalog                                   |
| `2026-09-01-user-gender.sql`                          | `users.gender` (`him` / `her` / `unspecified`) for PDF issued-by verbs             |
| `2026-09-01-plan30-invoicey-drive.sql`                | Plan 30 Invoicey Drive settings, devices, pair grants                              |

Apply Plan 19 before deploying referral routes (`/r/*`, `/settings/account/referrals`, admin users list).
