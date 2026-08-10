# Applied DDL records

The repo is **push-only** — `drizzle-kit push` diffs `src/schema.ts` against the
live database and there are no generated migration files, so ordinarily nothing
records *what was actually run*. These files do.

They are not run automatically and drizzle-kit does not read them. Each is
idempotent (`IF NOT EXISTS`, `DO $$ … EXCEPTION WHEN duplicate_object`), so
re-running one is a no-op.

## Why these exist

`bun db:push` **cannot be run unattended on this database.** On the Plan 14
schema it twice offered to *truncate a table containing production rows*:

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

Split anything that adds a `NOT NULL UNIQUE` column to a populated table into
two steps (add nullable + backfill, then tighten), as
`2026-08-11-plan14-workspace-slug.sql` does.
