# Research: Personal invoice archive (auto-save PDFs)

**Status:** Direction selected — Invoicey Drive (Plan 30)
**Researched:** 2026-09-01
**Selected:** 2026-09-01

A Vercel-hosted Invoicey process cannot write into a Mac folder, iCloud Drive, or Proton Drive. Those clouds accept files through the user's device. The selected product is a **macOS companion** (Invoicey Drive): File Provider + menu bar, optional mirror into iCloud/Proton/`_faktury`. Specified in [`specs/invoicey-drive.md`](../specs/invoicey-drive.md) and [ADR 0041](../decisions/0041-invoicey-drive-companion.md).

Google Drive / Dropbox / OneDrive / WebDAV remain possible **later server destinations**. They are not iCloud. They are not Plan 30.

## User problem

After issue, the operator downloads the PDF into:

```text
/Users/filipditrich/Work/NFCtron/_faktury/{year}/faktura_{n}.pdf
```

Invoicey already stores a canonical copy on UploadThing (`tryPersistInvoiceArtifacts`). That is not a Finder folder.

## Constraint

Issue runs on Vercel (web, Slack, hosted MCP). It can HTTP-upload. It cannot open `/Users/...` or File Provider mounts.

| Kind                      | Who writes  | Web / Slack issue?                | iCloud / Proton?                          |
| ------------------------- | ----------- | --------------------------------- | ----------------------------------------- |
| Invoicey Drive (selected) | Mac app     | Yes, if the Mac is on and polling | Mirror folder, or the Drive domain itself |
| Local MCP / launchd       | Mac process | Only if that process runs         | Write into a sync root                    |
| Server destination        | Vercel      | Yes                               | No                                        |

## Provider facts (unchanged)

- **iCloud Drive:** no third-party folder upload API. CloudKit is an app container. [Designing for Documents in iCloud](https://developer.apple.com/library/archive/documentation/General/Conceptual/iCloudDesignGuide/Chapters/DesigningForDocumentsIniCloud.html).
- **Proton Drive:** official CLI + SDK on the user's machine. SDK is not ready for third-party production. No OAuth for SaaS. [ProtonDriveApps/sdk](https://github.com/ProtonDriveApps/sdk), [Drive CLI](https://proton.me/support/drive-cli).
- **Google Drive / Dropbox / OneDrive / WebDAV:** real server upload APIs. Later, not Plan 30.
- **Safari** has no `showDirectoryPicker`. [WebKit oppose](https://github.com/WebKit/standards-positions/issues/28).

## Sources

- `packages/invoice-tools/src/invoice-artifacts.ts`
- [`macos-archive-app.md`](./macos-archive-app.md) (play sketches; Drive is the product)
