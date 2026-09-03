# Plan 18b — Platform admin monitor

Maps to roadmap **Plan 18b**. Spec:
[`docs/specs/platform-admin.md`](../../docs/specs/platform-admin.md).
ADR: [`docs/decisions/0024-platform-admin-user-flag.md`](../../docs/decisions/0024-platform-admin-user-flag.md)
(no new ADR — this plan is read-only plus repairs).

## Goal

Turn `/admin` into the morning ops console: truthful aggregates, global AI
usage, invoice/issuer drill-down, richer lists. No new tenant mutations.

## Exit criteria

- [x] Spec + roadmap Plan 18b
- [x] Dashboard uses SQL aggregates; monthly issued/paid chart; volume by currency
- [x] `/admin/ai` + workspace grant/usage history
- [x] Read-only invoice and issuer detail; list rows link through
- [x] Workspace/user lists show plan, tokens, last session
- [x] Platform audit includes `platform_plan_assign` / `platform_plan_update`
- [x] List cap is visible; i18n cs/en; typecheck / focused tests

## Explicitly out of scope

- Impersonation, freeze/ban, session/key revoke, email suppression lift
- Cross-tenant invoice/issuer/client mutations
- In-app log tail (Better Stack)
