# 0046: Workspace freeze is occupancy, not an entitlement

## Status

Accepted (Plan 18c, 2026-09-03)

## Context

Platform admin can already assign plans, grant tokens, and delete a workspace
([ADR 0024](./0024-platform-admin-user-flag.md),
[ADR 0035](./0035-plans-are-shared-entitlement-rows.md)). What it cannot do is
**stop a tenant from writing** without destroying their books.

Entitlements answer “may this workspace do X”. Freezing answers “is this
workspace allowed to act at all”. Putting freeze on the plan blob would make
every write path grow a second meaning of `false`, and a plan edit would thaw
or freeze every workspace on that plan.

Impersonation was rejected in Plan 18 / 18b: support stays inside `/admin`.
A frozen workspace must remain **readable** so an operator can still see
invoices, PDFs, and members.

## Decision

1. **Column, not entitlement.** `workspaces.frozen_at` (null = live),
   `frozen_by` (platform-admin user id, no FK — same constraint as
   `plan_assigned_by`), `freeze_reason` (required on freeze, short).
2. **Fail closed on tenant writes.** One helper in `@invoicey/db`
   (`assertWorkspaceWritable`) is called from web server actions, MCP / Eve
   tools, companion, Drive write paths, and crons that insert or email. Reads
   stay open. Platform-admin mutations (unfreeze, plan, tokens, revoke,
   disconnect) stay open.
3. **Sign-in stays.** Members can open the app and see a freeze banner; they
   cannot issue, send, sync, draft with AI, or invite. Issued PDF / ISDOC
   URLs keep working.
4. **Crons skip frozen workspaces.** Recurring drafts and overdue reminders
   do not run. Bank sync does not run (operator disconnects if the token
   itself is the problem).
5. **Not a user ban.** Disabling an account is Plan 18d. Freeze is per
   workspace; a user in two workspaces can still write in the live one.
6. **Audited.** `platform_workspace_freeze` / `platform_workspace_unfreeze`
   on `security_audit_events`. Only `users.platform_role = admin` may toggle.

## Consequences

- Every new tenant mutation must call `assertWorkspaceWritable`. Forgetting
  it is the failure mode — same class as forgetting `requirePlatformAdmin()`
  on a new `/admin` route.
- Freeze does not revoke sessions. Stolen-session response is revoke on the
  user detail page (Plan 18c), not freeze.
- Deleting a workspace remains the irreversible path; freeze is the reversible
  one.

## Alternatives considered

**Entitlement flag `features.frozen`.** Rejected — plan-shaped, shared across
workspaces on that plan, and it duplicates occupancy with “may they use
banks / agents”.

**Login-as to disable things in the tenant UI.** Rejected — Plan 18 north
star.

**Pause only AI / MCP.** Too narrow; abuse and legal holds need every write
stopped.

## Plans touched

- Plan 18c (platform admin support control)

## References

- [ADR 0007](./0007-workspace-scoped-data-model.md)
- [ADR 0024](./0024-platform-admin-user-flag.md)
- [ADR 0035](./0035-plans-are-shared-entitlement-rows.md)
- [platform-admin.md](../specs/platform-admin.md)
