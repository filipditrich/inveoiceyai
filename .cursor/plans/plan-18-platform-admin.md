# Plan 18 — Global platform admin

Maps to roadmap **Plan 18**. ADR: [`docs/decisions/0024-platform-admin-user-flag.md`](../../docs/decisions/0024-platform-admin-user-flag.md).

## Goal

Add a user-level platform admin role (separate from workspace owner/admin), bootstrap it for operators, and ship an isolated `/admin` console with cross-tenant metrics and list views.

## Exit criteria

- [x] ADR 0024 accepted; roadmap Plan 18 section exists
- [x] `users.platform_role` (`none` | `admin`) + Better Auth `additionalFields` + `requirePlatformAdmin()`
- [x] `INVOICEY_PLATFORM_ADMIN_EMAILS` session-create promote + `grant-platform-admin.ts` script
- [x] `/admin` route group (dashboard, users, workspaces, invoices, issuers) gated by platform admin
- [x] Cross-tenant queries only under `apps/web/lib/admin/*`; audit grant/revoke
- [x] Admin nav entry visible only to platform admins; `proxy.ts` matcher includes `/admin`
- [x] i18n (`cs` / `en`) for admin chrome
- [x] Typecheck / lint / focused tests pass; deslop before commit

## Explicitly out of scope

- Better Auth admin plugin (ban / impersonation)
- MCP/Eve inheriting platform admin
- Cross-tenant mutations of invoices / issuers / clients
- Postgres RLS
