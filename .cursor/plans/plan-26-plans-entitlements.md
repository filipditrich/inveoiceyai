# Plan — Plans, entitlements, and workspace permissions

**Status:** 26a–26d implemented (26d editor UI pending); 26e pending  
**ADR:** [0035](../../docs/decisions/0035-plans-are-shared-entitlement-rows.md) ·
[0036](../../docs/decisions/0036-managed-client-catalogs.md) ·
[0037](../../docs/decisions/0037-declarative-token-grants.md) ·
[0038](../../docs/decisions/0038-permission-catalog-with-role-presets.md) ·
[spec](../../docs/specs/plans-entitlements.md)

## Goal

One `plans` table driving every workspace limit and feature flag through
resolved entitlements, activated manually by platform admin. The target
outcome is the sponsored-plan case: NFCtron contractors, each in their own
isolated workspace with their own IČO as issuer, able to invoice only the
NFCtron entities in a managed catalog, on a token allowance Invoicey controls.

Nothing in the app may branch on `plan.key`. Behaviour reads only
`resolveEntitlements()`.

## Stage 26a — plans and entitlement resolution

**Schema** (`packages/db/src/plans.ts`, new module — `workspaces.ts` and
`auth-schema.ts` both import it, same reason `workspaces.ts` is standalone):

- `plans`: `id`, `key` unique, `name`, `kind`, `entitlements` jsonb,
  `auto_assign_email_domains` text[], `is_default` bool, `archived_at`
- `workspaces`: `+ plan_id` (NOT NULL, `ON DELETE RESTRICT`),
  `+ entitlement_overrides` jsonb null, `+ plan_assigned_at`,
  `+ plan_assigned_by`
- Partial unique index enforcing exactly one `is_default` plan
- SQL migration under `packages/db/sql/` (do **not** unattended `db:push` — the
  `plan_id` backfill must run before the NOT NULL)

**Backfill order:** insert the four seed plans → set every existing workspace to
`free` → add NOT NULL. No grandfathering overrides: everyone lands on Free, and
platform admin upgrades the ones that should be higher. That makes admin
assignment and discretionary token grants load-bearing from day one rather than
nice-to-have, so both ship in 26a/26b as real UI, not scripts.

**Resolution** (`apps/web/lib/entitlements/`):

- `EntitlementsSchema` (Zod) + `DEFAULT_ENTITLEMENTS`
- `resolveEntitlements(planEntitlements, overrides)` — pure deep merge, arrays
  replaced wholesale. Unit-tested against a table of merge cases.
- `getEntitlements()` — memoized per request next to `requireWorkspace()`
- `requireEntitlement(ctx, path)` throwing `ForbiddenError`

**Seeds:** the matrix in the spec, as a `packages/db/scripts/seed-plans.ts`
that upserts builtin rows by `key` and is safe to re-run.

**Assignment:** `workspace-bootstrap.ts` resolves domain → plan on every
workspace create (verified email only), falling back to `is_default`. Manual
assignment sets `plan_assigned_by` and is never overwritten.

**Admin:** `/admin/plans` list + editor (entitlements through a typed form, not
raw JSON), `/admin/workspaces/[id]` plan assignment + overrides, showing the
resolved result.

**Product:** workspace settings plan card — current plan, resolved limits,
usage against them.

## Stage 26b — token grants

- `workspace_token_grants` table, unique `(workspace_id, rule_key)`
- `applyGrantRule(tx, workspaceId, rule)` — insert-or-skip and credit in one
  transaction; returns whether it fired (drives the notification)
- `signup` rules applied in bootstrap; `first_invoice_issued` applied inside
  `issueInvoiceById` after numbering succeeds
- Move the existing `adminGrantTokens` onto the ledger: `rule_key =
"manual:<uuid>"`, note + attribution kept, security-audit event kept
- `ai_token_balances.monthly_limit` seeded from the plan on assignment and on
  renewal; `renew` cron reads the plan
- First-invoice reward notification (in-app toast + `@invoicey/emails`
  template), cs/en, fired only on a real ledger insert
- Top-up UI stub: visible when `ai.topUpEnabled`, states that purchase is not
  yet available. No payment path.

## Stage 26c — managed clients

- `plan_clients` table, unique `(plan_id, ico)`; admin adds by IČO with ARES
  lookup filling the snapshot
- `clients.plan_client_id` column
- `syncPlanClients(planId)` upserting into every workspace on the plan, matched
  on the existing normalized-IČO identity; runs on catalog write and on
  assignment
- Revocation clears `plan_client_id`, deletes nothing
- `createMode: "managed"` enforcement: client create/edit/delete server actions,
  ARES lookup route, import path, MCP `clients` tools, Eve/Slack
  `create_invoice`; invoice client picker filtered to managed rows
- UI: managed clients render with a plan badge and no edit affordance

## Stage 26d — permissions

- `apps/web/lib/authz/catalog.ts` — permission strings + role presets
- `assertCan(ctx, permission)` — entitlement gate → preset → member override
- `members.permission_overrides` jsonb (grant/deny arrays)
- Wire `assertCan()` into **every** mutation surface, including agent tools and
  cron, before removing `requireRole()` from call sites
- Members settings: role picker always; per-member override editor only when
  `permissions.mode === "advanced"`
- Navigation and page shells hide what `assertCan()` would deny — hiding is in
  addition to the server gate, never instead of it

## Stage 26e — quotas and Enterprise policy

- `assertSeatAvailable()` before invite and before accept; `assertIssuerQuota()`
  before issuer create. Write path only.
- `allowedEmailDomains` checked at invite send **and** at invitation accept
- Audit retention applied per plan in the security-audit prune path
- Over-limit workspaces (post-downgrade) render a banner, stay fully readable

## Exit criteria

- [ ] Four seeded plans; every workspace has a `plan_id`; no code reads
      `plan.key`
- [ ] `resolveEntitlements()` unit tests cover merge, unlimited (`null`), and
      array replacement
- [ ] `@nfctron.com` signup lands on the NFCtron plan, including a second
      workspace created later
- [ ] Managed workspace cannot create a client or invoice a non-catalog party
      from web, import, MCP, or Slack
- [ ] Adding a catalog entity appears in all granted workspaces
- [ ] Grants apply exactly once under retry; platform admin can gift tokens with
      attribution
- [ ] Downgrade to Free leaves an over-limit workspace readable, deletes nothing
- [ ] `assertCan()` guards every mutation surface; `requireRole()` gone from
      call sites
- [ ] Spec, four ADRs, roadmap, cs/en catalogs, `typecheck` / `lint` / `test` /
      `build`

## Out of scope

Payment-driven activation and billing, pooled cross-workspace token budgets,
workspace-authored custom roles, per-member client/issuer scoping.
