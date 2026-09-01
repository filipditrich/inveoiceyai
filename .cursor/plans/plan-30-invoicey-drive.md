# Plan 30 — Invoicey Drive

**Status:** proposed (grill closed; wait for shared-understanding confirm)
**ADRs:** [0041](../../docs/decisions/0041-invoicey-drive-companion.md), [0042](../../docs/decisions/0042-drive-device-pairing.md), [0043](../../docs/decisions/0043-drive-layout-workspace-issuer-template.md)
**Spec:** [invoicey-drive.md](../../docs/specs/invoicey-drive.md)
**UI:** [invoicey-drive.md](../../docs/ui/invoicey-drive.md)

## Goal

Pair a Mac companion, list issued invoices as files in Finder (Invoicey Drive), optional mirror folder. Web owns pairing, index, PDF bytes, Settings, promo, docs.

## Order

### 30a — Drive API + pairing (this repo)

1. Layout template parser + preview (tokens, require `{number}` or `{name}`, sanitize, tests)
2. `drive_user_settings` / `drive_devices` / `drive_pair_grants` SQL
3. `/drive/connect` confirm page + `POST /api/drive/token` (Associated Domains + local scheme)
4. `GET /api/drive/index` and artifact byte routes
5. `/settings/account/drive` (download, template, hide workspaces, devices)
6. Audit events

### 30b — Web promo + docs (this repo)

1. Fumadocs `integrations/invoicey-drive` (macOS 14+, install, tokens)
2. Marketing companion mention
3. Post-issue banner when the user has zero devices
4. Download placeholder until the first notarized `.dmg`

### 30c — Mac app (sibling `invoicey-mac`)

1. Menu bar + Keychain + connect session + login item
2. File Provider domain + enumerator from index
3. On-demand PDF fetch
4. Optional mirror folder bookmark
5. Notarized `.dmg` (macOS 14+)

Do not start 30c until 30a index + PDF routes work against staging.

## Out of 30

Windows, iOS Files, invoice create/issue, server iCloud/Proton APIs, APNs, Mac App Store.
