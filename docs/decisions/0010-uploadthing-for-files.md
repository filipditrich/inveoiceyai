# 0010: UploadThing for file uploads

## Status

Accepted (Phase 0, 2026-05-03)

## Context

Issuer businesses need to upload three small image assets:

- **Logo** — printed on the PDF header (PNG/JPG/SVG, typically ≤ 1 MB)
- **Stamp** (razítko) — optional graphic embedded near the totals (PNG with transparency, ≤ 1 MB)
- **Signature** — optional handwritten-signature scan (PNG with transparency, ≤ 1 MB)

Future asset surfaces (post-MVP):

- Email-attachment fonts/templates (Plan 11)
- Generic "attachments" on invoices (forever-maybe)

Storage options:

1. **UploadThing** — Next.js–native upload-as-a-service with progress, resumability, S3-backed; Vercel-friendly; minimal boilerplate
2. **Vercel Blob** — Vercel-native, simple, but plain HTTP upload UX (no progress UI, no automatic resumes)
3. **Direct-to-S3 / R2** — most control, most code; we'd build the upload UI from scratch
4. **Base64 in DB** — fits 1 MB but wastes JSON-payload size; not great for replacing-and-keeping-old (snapshot policy, see [ADR 0008](./0008-snapshot-issuer-client-at-issue-time.md))
5. **A third-party PDF-friendly service (Bunny CDN, Cloudflare Images, …)** — overkill

Forces:

- The user explicitly asked for UploadThing
- We need a _URL_ (snapshots store URLs — see [ADR 0008](./0008-snapshot-issuer-client-at-issue-time.md))
- Old asset URLs must remain valid forever for historical PDF re-renders
- Drag-and-drop, progress, type/size validation are table-stakes UX

## Decision

File uploads use **UploadThing** with an `apps/web/app/api/uploadthing/route.ts` route handler and the `<UploadButton>` / `<UploadDropzone>` React components.

Specifically:

- Route handler defines named "endpoints": `issuerLogo`, `issuerStamp`, `issuerSignature`
- Each endpoint sets `maxFileSize` and `acceptedFileTypes` (PNG/JPG/SVG; SVG is allowed for logo only)
- The `onUploadComplete` server-side callback returns the URL; the client-side hook receives it and the form sets `logoUrl` / `stampUrl` / `signatureUrl` on the issuer
- **No deletion on replace**: replacing a logo creates a new file; the old file stays around for historical PDF re-renders that point at it
- A future cleanup job (post-MVP, see snapshots TODO) catalogs unreferenced assets

Env vars: `UPLOADTHING_TOKEN`, `UPLOADTHING_APP_ID` (per [`architecture.md`](../architecture.md) env-var table).

## Consequences

### Positive

- Out-of-the-box upload UX with progress, drag-and-drop, type/size validation
- URLs are stable; UploadThing handles the S3-backing
- Setup is one route + one component for our needs
- Vercel-friendly: no large file buffering through our serverless function

### Negative

- Vendor lock-in to UploadThing. Mitigation: assets are addressed by URL only; switching means generating new URLs and writing a migration script that re-uploads.
- Cost grows with retained-old-files policy. For an invoicing tool used at personal/team scale, this stays well within UploadThing's pricing tiers; revisit if usage explodes.
- Replacing-but-keeping policy means the issuer detail UI must be explicit ("Upload new logo" rather than "Replace logo") to avoid confusion.

### Neutral

- We may at some point add image transforms (auto-strip EXIF, force a max dimension). UploadThing supports `before-upload` hooks; first pass relies on user to upload sensible files.
- SVGs are allowed for the logo. `@react-pdf/renderer` supports raster only via `<Image>`; SVGs need to be rasterized server-side at PDF render time. Plan 3 handles this — likely using `sharp` to render SVG to PNG buffer.

## Plans touched

- Plan 5 (issuers UI) — primary consumer
- Plan 3 (PDF rendering) — consumes the URLs at render time
- Future GC job (post-MVP) — cleans unreferenced assets

## References

- [UploadThing docs](https://uploadthing.com)
- [`architecture.md`](../architecture.md) — env-var table
