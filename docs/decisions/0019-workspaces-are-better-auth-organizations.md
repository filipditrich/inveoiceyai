# 0019: `workspaces` _is_ the Better Auth `organization` model

## Status

Accepted (Plan 14, 2026-08-11)

> ADR 0018 (Better Auth over Clerk, OAuth-only) and ADR 0020 (machine identity)
> are written in a later stage of Plan 14; this ADR is landed early because the
> mapping below is hard to reverse once user data exists.

## Context

[ADR 0018](./0018-better-auth-oauth-only.md) adopts Better Auth, whose `organization` plugin supplies exactly the tenancy features Plan 14 needs: multi-member workspaces, `owner`/`admin`/`member` roles, invitations, and `session.activeOrganizationId`.

But we already have a tenancy table. [ADR 0007](./0007-workspace-scoped-data-model.md) put a non-nullable `workspace_id` on every business-data row and prefixed every composite index with it, against a `workspaces` registry. Production data already lives under one such row.

So the plugin's `organization` model and our `workspaces` table describe the same concept. Two ways to reconcile them:

1. **Mirror** — let the plugin own its own `organization` table, keep `workspaces` as ours, and sync between them with `organizationHooks`.
2. **Identity** — point the plugin's `organization` model at the existing `workspaces` table via the Drizzle adapter's schema map.

Forces:

- Better Auth ids are `text`. `workspaces.id` is already `text`, and so is every `workspace_id` column (ADR 0007). No type surgery is needed for either option.
- ADR 0007 warned that the danger in this model is a query that forgets its `workspace_id` predicate. Anything that adds a second identifier multiplies that risk.
- The existing production workspace row and every invoice, client and issuer pointing at it must survive.

## Decision

The `workspaces` table **is** the `organization` model. The mapping lives in `authSchema` in [`packages/db/src/auth-schema.ts`](../../packages/db/src/auth-schema.ts):

<!-- prettier-ignore -->
```ts
export const authSchema = {
  user, session, account, verification,
  organization: workspaces,   // <- the decision
  member, invitation,
  oauthApplication, oauthAccessToken, oauthConsent, apikey,
};
```

`workspaces` gains the columns the plugin requires — `slug` (not null, unique), `logo`, `metadata` — alongside the existing `id`, `name` and `created_at`.

The map lives in `packages/db`, beside the tables, rather than inline in the auth server config, so every consumer (the web auth server, the schema checker, future scripts and the MCP app) resolves tenancy the same way instead of re-deriving it.

## Consequences

**Good:**

- `session.activeOrganizationId` is _literally_ the value every query already puts in `WHERE workspace_id = ?`. There is one tenancy identifier and no translation step for a caller to forget — the failure mode ADR 0007 exists to prevent.
- No sync surface. Mirroring would need create/update/delete hooks that can drift, partially fail, or be bypassed by the plugin's own endpoints.
- Existing rows keep their ids. `00000000-0000-4000-8000-000000000001` remains a valid organization id, and no business data is rewritten.
- `member` and `invitation` take real foreign keys to `workspaces.id`, so membership cannot outlive a workspace.

**Bad / accepted risk:**

- `workspaces` is no longer solely ours. Its column set is dictated by the plugin, and a Better Auth release can add required columns. Mitigated by pinning `better-auth` to an exact version and running `bun run --cwd apps/web check:auth-schema` — which reads `auth.options` from the real auth server and asserts every model resolves to a table with all its columns — before applying any schema change.
- The plugin can create and delete workspaces through its own endpoints. Workspace lifecycle is therefore partly outside our code, which is why deletion cascades are declared on the tables rather than enforced in application code.

## Alternatives considered

**Mirror the two tables (option 1).** Rejected: it buys ownership of a table we would then have to keep byte-identical to another one, and pays for it with a second id, a translation function at every call site, and hooks that can silently drift. The ownership is worth less than the invariant it costs.

**Rename `workspaces` to `organization`.** Rejected: "workspace" is the product's term (see [glossary](../glossary.md)) and appears in every `workspace_id` column, index name and ADR. Renaming the table to match a library's vocabulary is the tail wagging the dog.

## References

- Amends [ADR 0007](./0007-workspace-scoped-data-model.md) — the `workspace_id`-everywhere convention is unchanged and is now actually enforced by the session-derived accessor 0007 asked for.
- [ADR 0018](./0018-better-auth-oauth-only.md) — why Better Auth.
- [`packages/db/src/workspaces.ts`](../../packages/db/src/workspaces.ts) — the table, in its own module so `schema.ts` and `auth-schema.ts` can both reference it without a cycle.
