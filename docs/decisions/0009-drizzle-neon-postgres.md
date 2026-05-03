# 0009: Drizzle ORM + Neon Postgres

## Status

Accepted (Phase 0, 2026-05-03)

## Context

The app needs a relational store with:

- ACID transactions (numbering atomicity, see [`numbering.md`](../domain/numbering.md))
- JSONB columns (snapshots, full payload — see [ADR 0008](./0008-snapshot-issuer-client-at-issue-time.md))
- Decent read perf for the data grid + dashboard
- Cheap dev / prod / preview environments
- TypeScript-first ORM that doesn't overreach

Database options:

- **Neon Postgres** — serverless Postgres, Vercel Marketplace integration, branching, generous free tier
- **Supabase Postgres** — also great; brings auth/storage/realtime we don't currently need
- **Vercel Postgres (which is Neon underneath)** — equivalent to Neon
- **PlanetScale (MySQL)** — no JSONB primitives, no advisory locks (we use Postgres-specific stuff)
- **SQLite + Turso** — interesting but Drizzle's Postgres dialect has the best feature support

ORM options:

- **Drizzle** — TypeScript-first, SQL-like API, lightweight, no decorators, no runtime schema parsing. Excellent ergonomics with `drizzle-zod` (interop with our Zod schemas)
- **Prisma** — heavier, schema in its own DSL, generates TS types; we'd lose direct SQL ergonomics
- **Kysely** — SQL builder without an ORM layer; great types, but we want migrations + schema-as-code in one tool
- **Raw SQL + zod for return types** — works, but tedious for a CRUD-heavy app

Forces:

- We are explicit fans of "describe schema in TypeScript, get migrations free" → Drizzle
- Vercel Marketplace simplifies provisioning Neon → set the integration, get `DATABASE_URL` injected
- Drizzle's bundled migrator (`drizzle-kit`) is enough for our scale
- Drizzle plays nicely with both serverless (Neon HTTP driver) and Node.js (Neon WS driver) — we'll use the appropriate one per runtime

## Decision

The DB is **Neon Postgres**, accessed through **Drizzle ORM**.

Specifically:

- `packages/db` exports the schema as Drizzle table builders, the migrator config, and a `getDb()` helper that returns a typed client
- Connection: `@neondatabase/serverless` HTTP driver in serverless functions; `drizzle-orm/neon-http` adapter
- Migrations: `drizzle-kit generate` produces SQL; `drizzle-kit migrate` runs it; we commit both the schema source and the generated SQL
- Typing: each table has a `selectSchema = createSelectSchema(table)` and `insertSchema = createInsertSchema(table)` from `drizzle-zod`, so DB shapes have Zod parsers at hand
- Two URL env vars: `DATABASE_URL` (pooled, used by app) and `DATABASE_URL_UNPOOLED` (direct, used by migrations)
- Branching: each Vercel Preview gets a branched Neon DB (Neon's Vercel integration handles this)

## Consequences

### Positive

- Drizzle types flow into RSC pages and server actions without ceremony
- `WHERE workspace_id = $X` (per [ADR 0007](./0007-workspace-scoped-data-model.md)) is a simple combinator
- `SELECT … FOR UPDATE` for numbering atomicity is supported by Postgres + Drizzle's `.for('update')`
- JSONB columns for snapshots are first-class
- Neon's branching makes preview deploys safer (each branch has its own DB)

### Negative

- Drizzle is younger than Prisma; some edge cases (complex relations, advanced schema) may surface library bugs. We accept this for the better TS ergonomics.
- Neon HTTP driver does not support persistent connections; long-running transactions need the WS driver (used in migrations and any post-MVP cron jobs)
- We commit to Postgres-specific features (`SELECT FOR UPDATE`, JSONB, `now() AT TIME ZONE`) — switching to MySQL/SQLite later is a non-trivial rewrite. Acceptable.

### Neutral

- We do not use Postgres RLS in MVP (see [ADR 0007](./0007-workspace-scoped-data-model.md))
- We do not use Drizzle's relational query builder at MVP scale; we'll adopt it ad hoc when nested reads warrant it

## Plans touched

- Plan 1 (bootstrap) — wire Drizzle, create migrations folder, run first migration
- Every later plan touches the schema additively

## References

- [Drizzle ORM](https://orm.drizzle.team)
- [Neon Postgres](https://neon.tech)
- [`drizzle-zod`](https://orm.drizzle.team/docs/zod)
