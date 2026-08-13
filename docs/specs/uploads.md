# Uploads (UploadThing)

## Goal

Issuer businesses upload three small image assets used on PDF renders: logo, stamp (razítko), and signature. URLs are stored on `IssuerSnapshot` and frozen into invoice snapshots at issue time.

## Inputs / outputs

| Endpoint          | MIME      | Max size | Snapshot field |
| ----------------- | --------- | -------- | -------------- |
| `issuerLogo`      | PNG, JPEG | 1 MB     | `logoUrl`      |
| `issuerStamp`     | PNG, JPEG | 1 MB     | `stampUrl`     |
| `issuerSignature` | PNG, JPEG | 1 MB     | `signatureUrl` |

Client receives `file.ufsUrl` (or `file.url`) from `onUploadComplete` and writes it into the issuer form before save.

## Approach

- Route handler: `apps/web/app/api/uploadthing/route.ts` via `createRouteHandler`
- File router: `apps/web/app/api/uploadthing/core.ts`
- React: `@uploadthing/react` `UploadButton` typed against `OurFileRouter`
- **Replace-without-delete:** uploading a new asset creates a new file; old URLs remain valid for historical PDFs
- Env: `UPLOADTHING_TOKEN` (required for live uploads). Arbitrary pasted URLs
  are not accepted; PDF rendering only reads trusted UploadThing HTTPS URLs or
  validated inline fixture images.

## Issued invoice artifacts (server upload)

Canonical PDF (ISDOC.PDF) and standalone `.isdoc` XML are uploaded with **`UTApi.uploadFiles`** from `@invoicey/invoice-tools/artifacts` after issue. Requires `UPLOADTHING_TOKEN`. URLs and SHA-256 digests land on `invoices.pdf_url` / `invoices.isdoc_url` and their matching hash columns. Downloads never silently regenerate an issued artifact.

## Historical import (client upload)

| Endpoint               | MIME | Max size | Count |
| ---------------------- | ---- | -------- | ----- |
| `importedInvoicePdf`   | PDF  | 16 MB    | 40    |
| `importedInvoiceIsdoc` | XML  | 2 MB     | 40    |

Authenticated via workspace session middleware. Spec: [`invoice-import.md`](./invoice-import.md).

## Open questions / TODOs

- `TODO(plan-9):` GC unreferenced UploadThing files (issuer assets + orphaned invoice artifacts)

## References

- [ADR 0010](../decisions/0010-uploadthing-for-files.md)
- [ADR 0008](../decisions/0008-snapshot-issuer-client-at-issue-time.md)
