# Uploads (UploadThing)

## Goal

Issuer businesses upload three small image assets used on PDF renders: logo, stamp (razítko), and signature. URLs are stored on `IssuerSnapshot` and frozen into invoice snapshots at issue time.

## Inputs / outputs

| Endpoint | MIME | Max size | Snapshot field |
| --- | --- | --- | --- |
| `issuerLogo` | PNG, JPEG, SVG | 1 MB | `logoUrl` |
| `issuerStamp` | PNG, JPEG | 1 MB | `stampUrl` |
| `issuerSignature` | PNG, JPEG | 1 MB | `signatureUrl` |

Client receives `file.ufsUrl` (or `file.url`) from `onUploadComplete` and writes it into the issuer form before save.

## Approach

- Route handler: `apps/web/app/api/uploadthing/route.ts` via `createRouteHandler`
- File router: `apps/web/app/api/uploadthing/core.ts`
- React: `@uploadthing/react` `UploadButton` typed against `OurFileRouter`
- **Replace-without-delete:** uploading a new asset creates a new file; old URLs remain valid for historical PDFs
- Env: `UPLOADTHING_TOKEN` (required for live uploads). Without it, the UI still accepts pasted URLs.

## Open questions / TODOs

- `TODO(plan-9):` GC unreferenced UploadThing files
- `TODO(plan-3-followup):` SVG logo rasterization at PDF render if not already handled

## References

- [ADR 0010](../decisions/0010-uploadthing-for-files.md)
- [ADR 0008](../decisions/0008-snapshot-issuer-client-at-issue-time.md)
