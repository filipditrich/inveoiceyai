# 0038: Permissions are a flat catalog with role presets and member overrides

## Status

Accepted (2026-08-27)

## Context

Pro and Enterprise need in-workspace permissions: someone may create an issuer
but not delete one; only some members may see the payments layer at all. Today
authorization is a three-level rank check — `requireRole()` in
`apps/web/lib/auth/session.ts:157` comparing `owner > admin > member`.

A rank check cannot express "may issue invoices but may not see payments",
because that is not a point on a line.

The requirement is composable per-permission control. The risk is building an
access-control framework before a single team customer exists — the immediate
sponsored use case (NFCtron contractors) is entirely single-member workspaces
and needs none of this.

## Decision

1. A **flat permission catalog** of stable strings
   (`invoices:issue`, `payments:read`, `bank:manage`, `members:manage`, …). This
   lands first and in full, because it is what the chokepoint consults.
2. One chokepoint, **`assertCan(ctx, permission)`**, resolved in three steps:
   entitlement gate for the owning feature → role preset for the member's role →
   per-member override, where **deny wins over grant**.
3. **Role presets** (`owner`, `admin`, `accountant`, `issuer`, `viewer`) expand
   to permission sets in code. Members pick a preset; they do not author roles.
4. **Per-member overrides** are an explicit grant/deny list on top of the preset,
   gated by `entitlements.permissions.mode === "advanced"`. `"roles"` gives
   presets only; `"off"` hides the surface entirely.
5. `assertCan()` is wired into **every** mutation surface at introduction —
   server actions, API routes, MCP tools, Eve/Slack tools, cron — including the
   paths where every current preset would allow the action.
6. `requireRole()` is retained only as the implementation detail behind the
   `owner`/`admin` presets and is removed from call sites.

## Consequences

- The expensive, unavoidable part (a chokepoint on every route) is done once and
  early. Adding a permission later is a catalog entry plus a preset edit.
- Workspace-authored custom roles are **not** built. If a customer needs them,
  presets become seeded rows in a `workspace_roles` table without changing
  `assertCan()`'s contract.
- Slack, MCP, and Eve callers must resolve to a real member with a real
  permission set. A workspace-level API-key bypass would make the layer
  decorative, so the linked-identity requirement (ADR 0020) becomes load-bearing
  for authorization, not just attribution.
- Free workspaces carry the machinery with `mode: "off"`. That is deliberate:
  one code path, no untested second branch.

## Alternatives considered

**Fully composable per-member permissions with no presets.** Rejected as the
starting point — every workspace owner would have to design a role from scratch
to add one colleague. Presets plus overrides reach the same expressiveness with
a usable default.

**Better Auth organization `ac` / custom roles as the storage.** Deferred — the
plugin supports it, but the permission set must also be enforced in MCP, Eve,
and cron, which do not run through the Better Auth request path. A framework-
neutral catalog keeps one answer for every surface.

**Extend the existing `owner > admin > member` rank with more ranks.** Rejected
— the payments requirement is orthogonal to seniority and cannot be ordered.

**Ship permissions only when the first Pro customer arrives.** Rejected —
retrofitting a chokepoint into every existing route is strictly more expensive
than adding it while the routes are being touched anyway.

## Plans touched

- Plan 26 — Plans, entitlements, and workspace permissions

## References

- [ADR 0019](./0019-workspaces-are-better-auth-organizations.md)
- [ADR 0020](./0020-slack-identity-linking.md)
- [ADR 0035](./0035-plans-are-shared-entitlement-rows.md)
- [docs/specs/plans-entitlements.md](../specs/plans-entitlements.md)
