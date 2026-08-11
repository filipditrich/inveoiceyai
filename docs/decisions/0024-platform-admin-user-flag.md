# 0024: Platform admin is a user flag, not a workspace role

## Status

Accepted (Plan 18, 2026-08-11)

## Context

Workspaces are Better Auth organizations with `owner` / `admin` / `member` roles ([ADR 0019](./0019-workspaces-are-better-auth-organizations.md)). Business data is always scoped by `workspace_id` ([ADR 0007](./0007-workspace-scoped-data-model.md)).

We need a cross-tenant ops console (all users, workspaces, invoices, issuers, metrics). Options:

1. **Reuse org `admin` / fake membership in every workspace** — conflates tenancy with platform privilege; fights invite/list APIs and ADR 0019.
2. **Ops env API key for the UI** — machine identity, single default workspace, no per-human audit.
3. **User-level platform flag** — orthogonal to org roles; explicit gates and audited cross-tenant queries.

## Decision

1. Store `users.platform_role` as `"none" | "admin"` (default `"none"`), exposed to Better Auth via `user.additionalFields` with `input: false` (same pattern as `defaultWorkspaceId`).
2. Gate platform surfaces with `requirePlatformAdmin()`, which reads the **DB flag** (not env alone). Do not extend `WorkspaceRole` / `ROLE_RANK`.
3. Bootstrap via `INVOICEY_PLATFORM_ADMIN_EMAILS` (promote on session create; never auto-demote) and/or `packages/db/scripts/grant-platform-admin.ts`.
4. Cross-tenant queries live only under `apps/web/lib/admin/*` and `/admin/*`. Normal product code keeps mandatory `workspace_id` predicates.
5. Audit grant/revoke with `platform_admin_grant` / `platform_admin_revoke` on `security_audit_events`.

## Consequences

- Platform admin is independent of workspace membership; a user can be platform admin without being in every workspace.
- Forgetting to call `requirePlatformAdmin()` on a new `/admin` route is the failure mode — mitigated by a dedicated route group layout.
- Env allowlist only promotes; manual demotion sticks until re-promoted.

## Alternatives considered

**Better Auth `admin` plugin.** Deferred — ban/impersonation are not required for V1; a thin flag matches Plan 14/16 style.

**Ops `MCP_API_KEY` as human admin.** Rejected — wrong trust model for a browser console.

## Plans touched

- Plan 18 (platform admin)

## References

- [ADR 0007](./0007-workspace-scoped-data-model.md)
- [ADR 0018](./0018-better-auth-oauth-only.md)
- [ADR 0019](./0019-workspaces-are-better-auth-organizations.md)
- [ADR 0023](./0023-account-security-soft-devices.md)
