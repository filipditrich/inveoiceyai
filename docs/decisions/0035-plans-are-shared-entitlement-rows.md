# 0035: Plans are shared entitlement rows, not per-workspace flags

## Status

Accepted (2026-08-27)

## Context

Invoicey needs commercial tiers (Free, Pro, Enterprise) and at least one custom
tier. The driving case is sponsored: ~15 NFCtron contractors, each with their
own workspace and their own issuer, all sharing one set of rules. Adding a
fourth NFCtron entity to bill must appear in all fifteen workspaces at once, and
changing the AI allowance must be one edit.

Today there is nothing: `MONTHLY_INCLUDED_TOKENS` and `SIGNUP_GIFTED_TOKENS` are
module constants applied identically to every workspace, and there is no
platform-admin path to vary either.

The obvious cheap shape — `workspaces.plan` as an enum plus a per-workspace
override blob — fails exactly this case. Fifteen workspaces would carry fifteen
copies of the same override, and they would drift.

## Decision

1. A **`plans` table**, one row per commercial package. `plan 1:N workspaces`;
   `workspaces.plan_id` is `NOT NULL` and `ON DELETE RESTRICT`.
2. All tier behaviour lives in **`plans.entitlements` (jsonb)**, validated by one
   `EntitlementsSchema`. Free/Pro/Enterprise are seeded `kind: "builtin"` rows;
   NFCtron is a `kind: "custom"` row. A custom plan is data, not a code path.
3. **No code may branch on `plan.key`.** Behaviour reads only the output of
   `resolveEntitlements(plan.entitlements, workspace.entitlementOverrides)`, a
   pure deep merge memoized per request.
4. `workspaces.entitlement_overrides` stays, but as the **exception** for a
   genuine one-off — not the mechanism for a shared package.
5. **Assignment is manual by platform admin**, plus an automatic rule:
   `plans.auto_assign_email_domains` matched against the owner's _verified_
   email domain at workspace bootstrap. The rule keys off the person and fires
   on **every** workspace they create.
6. **Quotas are enforced on the write path only.** A downgrade never deletes and
   never blocks reads; an over-limit workspace is valid, it just cannot grow.

## Consequences

- Editing one plan row moves every workspace on it. Adding a sponsored partner
  is an `/admin` action with no deploy.
- A workspace's effective configuration is always `plan + overrides`, so the
  admin console must show both, resolved.
- `ai_token_balances.monthly_limit` becomes plan-derived instead of
  constant-derived; the constants survive only as Free's seed values.
- Domain-based assignment closes the second-workspace escape hatch, but means a
  contractor's _personal_ side workspace also lands on the sponsored plan. That
  is the intended trade: containment beats convenience here.
- `RESTRICT` on `plan_id` means plan deletion fails loudly while workspaces
  reference it. Archive (`archived_at`) is the supported removal.

## Alternatives considered

**`workspaces.plan` enum + per-workspace override jsonb.** Rejected — no shared
edit point, guaranteed drift across a sponsored cohort. This was the initial
proposal and the multi-workspace sponsorship requirement killed it.

**Plans as a TypeScript constant map, workspaces store the key.** Rejected —
every custom plan and every limit tweak becomes a deploy, and platform admin
cannot self-serve. Kept for the _seed_ of builtin rows only.

**Attach the plan to the user rather than the workspace.** Rejected — tenancy is
the workspace (ADR 0019), teams have many users, and entitlement resolution
would need an owner lookup on every request. The user's email domain is used as
an assignment _rule_ instead, which gets the containment without the coupling.

**A billing provider as source of truth (Stripe products/entitlements).**
Rejected for now — there is no payment path in this plan and manual activation
is the explicit requirement. The `plans` row remains the internal source of
truth if billing is added later.

## Plans touched

- Plan 26 — Plans, entitlements, and workspace permissions

## References

- [ADR 0019](./0019-workspaces-are-better-auth-organizations.md)
- [ADR 0024](./0024-platform-admin-user-flag.md)
- [ADR 0026](./0026-workspace-ai-tokens.md)
- [docs/specs/plans-entitlements.md](../specs/plans-entitlements.md)
