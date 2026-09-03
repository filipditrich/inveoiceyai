# Plan 18c — Platform admin support control

Maps to roadmap **Plan 18c**. Spec:
[`docs/specs/platform-admin.md`](../../docs/specs/platform-admin.md).
ADR: [`docs/decisions/0046-workspace-freeze.md`](../../docs/decisions/0046-workspace-freeze.md)
(freeze only — revoke / overrides / unpublish reuse existing tables).

## Goal

Give the operator **control** that matches the 18b monitor: cut access, lift
accidental blocks, and tailor one workspace — without impersonating or
editing a tenant’s books.

## Exit criteria

- [x] ADR 0046 + spec Approach (control) + this roadmap section
- [x] User detail: sessions + trusted devices + API key prefixes; revoke
      each (never `sessions.token` / `api_keys.key`)
- [x] Workspace entitlement-override editor (sectioned form, not raw JSON);
      clear overrides
- [x] Freeze / unfreeze; `assertWorkspaceWritable` on web, MCP/Eve,
      companion, Drive writes, recurring + reminder crons
- [x] Email suppression list + lift on workspace (and invoice detail)
- [x] Community-look unpublish from `/admin` (live catalog rows)
- [x] Bank connections listed without secrets; disconnect via existing
      `deleteFioConnection` / `deleteMonetaConnection`
- [x] New `platform_*` audit types on the platform log; i18n cs/en;
      typecheck / focused tests; apply freeze SQL on Neon

## Explicitly out of scope

- Impersonation / login-as
- User ban or `users.disabled_at` (Plan 18d)
- Invoice / client / issuer / look-document edits
- Showing bank ciphertext or API key plaintext
- In-app log tail, billing admin, entitlement kill-switches on the plan blob
- Slack unlink, cron last-run (Better Stack)

## Implementation notes

- Reuse tenant helpers; wrap with `requirePlatformAdmin()` and a
  `platform_*` audit row. Do not fork disconnect / unpublish / key-delete
  logic.
- Freeze SQL: `packages/db/sql/2026-09-03-plan18c-workspace-freeze.sql`
  (`frozen_at`, `frozen_by`, `freeze_reason`). Do not unattended `db:push`.
- Override save goes through `assignWorkspacePlan` / a sibling that already
  parses `EntitlementsSchema` — never write unchecked jsonb.
- List `api_keys` by `reference_id = userId`; display `name`, `start` /
  `prefix`, `created_at`, `last_request`. Delete via Better Auth or a
  direct row delete of that id only.
- Session revoke deletes the `sessions` row by id (not token).
