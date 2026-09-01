# 0041: Invoicey Drive is a macOS companion replica

## Status

Accepted (grill 2026-09-01)

## Context

Issued invoices already persist canonical PDF + ISDOC on UploadThing ([ADR 0010](./0010-uploadthing-for-files.md), [`specs/uploads.md`](../specs/uploads.md)). Operators still want those files in Finder, next to tax evidence, in a tree they control. A Vercel function cannot write iCloud Drive or Proton Drive. A Mac process can.

Alternatives:

1. **Local MCP / launchd puller** — works only when Cursor or a hidden script is running. No Finder identity.
2. **Server OAuth to Google Drive / Dropbox / WebDAV** — real for those clouds; not iCloud; not Proton.
3. **Website File System Access API** — Chromium-only; Safari has no directory picker.
4. **Full Invoicey Mac app** (builder, ARES, payments) — a second product.

## Decision

Ship **Invoicey Drive**: a macOS companion that is a file librarian, not a second Invoicey.

1. **File Provider domain** named Invoicey Drive. It appears in Finder under Locations, same class as Proton Drive. Tree of issued invoice files. Opening a dataless file downloads bytes from Invoicey.
2. **Menu-bar librarian** in the same app. Status, last sync, last error, Open in Finder, Connect / Sign out. Optional security-scoped **mirror folder** (iCloud Drive, Proton Drive, `_faktury`) that receives the same files.
3. **Replica.** UploadThing URLs stay the source of truth. Drive never becomes the numbering or artifact authority. Finder delete is local-only; the next sync restores the file. Dropping a file into the domain does not import or issue anything. Cancel happens only on the website.
4. **No plan gate.** Any signed-in user may pair. The index is every workspace they still belong to, minus workspaces they hide. Entitlements stay workspace-scoped (ADR 0035); Drive does not add a user-level flag.
5. **No builder, ARES, email, or payments** in the Mac app.
6. **Paid Apple Developer Program** for File Provider, notarization, and distribution.

The Swift app lives in a **sibling repo** (`invoicey-mac`). This Turborepo stays TypeScript. Invoicey (`apps/web`) owns pairing, the Drive HTTP API, Settings, marketing, and product docs.

Distribution is a **notarized `.dmg`** from Account Settings. No Mac App Store. macOS 14+. Login item on by default. V1 sync is poll (60s + Sync now + wake); APNs is later.

## Consequences

- Plan 30 is split: backend + web first, then the Mac app against a live API.
- Existing issuer `filenameTemplate` stays for email/download names. Drive uses a separate **layout template** that may contain `/` (folders). `invoiceArtifactFileNames` cannot express folders today because it stems the whole string.

## Alternatives rejected

**MCP-only archive.** Rejected: no Finder sidebar, no always-on replica after Slack/web issue.

**Server-side iCloud/Proton upload.** Rejected: no third-party API. See [`research/personal-invoice-archive.md`](../research/personal-invoice-archive.md).

**`apps/mac` in this monorepo.** Rejected: Xcode, signing, and notarization do not belong in bun/Turborepo.

**Mac App Store as v1.** Rejected: companion ships as a notarized download.

## Plans touched

- Plan 30 (Invoicey Drive)

## References

- [`specs/invoicey-drive.md`](../specs/invoicey-drive.md)
- [Apple File Provider](https://developer.apple.com/documentation/fileprovider/synchronizing-files-using-file-provider-extensions)
