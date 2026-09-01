# 0043: Drive tree is workspace / issuer / layout template

## Status

Accepted (grill 2026-09-01)

## Context

The operator's current archive is `{year}/faktura_{n}.pdf` under one folder. Invoicey is multi-workspace and multi-issuer. A flat year dump mixes legal entities. A File Provider domain needs a stable identity per item (UUID), plus a display path the user can reshape.

Issuer email already has `filenameTemplate` (`{kind}_{number}`) for download and attachment **file names**. That helper stems the whole string and cannot create folders.

## Decision

The Invoicey Drive root is:

```text
/{workspaceDisplayName}/{issuerDisplayName}/{layout…}
```

1. **Workspace folder** — Better Auth organization name. One folder per workspace the user is a member of (unless they hide it). Identity is `workspace_id`.
2. **Issuer folder** — current issuer business name. Identity is `issuer_id`. Issued snapshots do not rename the folder; the live issuer name does.
3. **Layout template** — user-configured path under the issuer. Slashes create folders. Tokens substitute invoice fields. Default: `{year}/{kind}_{number}`.
   - `{year}/{kind}_{number}` → `2026/faktura_2026001.pdf`
   - `{year}_{name}` → `2026_faktura_2026001.pdf` (no year folder; `{name}` is `{kind}_{number}`)
   - `{year}` / `{month}` come from `meta.issueDate` in Europe/Prague
4. Layout, `include_isdoc`, and hidden workspace ids live on a **user-scoped** `drive_user_settings` row (1:1 with the user). Every Mac rematerializes from that row. The mirror folder bookmark is the only per-Mac setting.
5. The template **must contain `{number}` or `{name}`** so two invoices under one issuer cannot share a file stem. If two live folder titles clash at the same parent, suffix the later one (`Filip's Workspace (2)`). Never overwrite.
6. PDF extension is added by the renderer, not the template. Optional sibling `.isdoc` uses the same stem (opt-in, default off).
7. Item identity in File Provider is `invoice_id` (+ artifact kind). A layout change **moves** the display path; it does not create a second invoice.
8. Workspace and issuer folder titles are the **live** display names. Rename moves the folder. Identity stays `workspace_id` / `issuer_id`.

Sanitize each path segment (Unicode fold, strip `/ \ :`). Reject `..`. Empty segment after sanitize → `invoice`.

## Consequences

- Changing the template rematerializes paths. The Mac app enumerates the new tree; leftover files from the old layout are removed from the domain (not from UploadThing).
- Workspace or issuer rename updates the folder title. File Provider must treat id as identity and name as metadata.
- `_faktury` compatibility is a default template plus an optional mirror folder, not a second product.

## Alternatives rejected

**Issuer-only tree** (no workspace). Rejected: Plan 20 users have several workspaces.

**Reuse `filenameTemplate` only.** Rejected: no folders; wrong owner (issuer email vs Mac user).

**Per-device layout copies.** Rejected: Macs would drift; Settings would lie.

**Clash overwrite.** Rejected: that is how a daňový doklad disappears.

## Plans touched

- Plan 30

## References

- [`specs/invoicey-drive.md`](../specs/invoicey-drive.md)
- `packages/invoice-core/src/artifact-filenames.ts`
