# Stored invoice artifact delivery

PDF and ISDOC downloads share `apps/web/lib/serve-invoice-file.ts` across the web, companion CLI, Drive, and generator routes.

## Download limits and failure behavior

- Storage has a **20-second total deadline**, covering response headers and the complete body. It is not reset as chunks arrive.
- The existing **25 MiB maximum** applies to the downloaded body. A larger declared `Content-Length` is rejected before reading; responses without that header are bounded while reading.
- Every attempt aborts its upstream fetch on exit, including rejection by HTTP status or declared size. Stream readers release their locks.
- A stored file is returned only after its entire body has been read and, for native issued invoices with a recorded SHA-256, its integrity verified. Partial or mismatched bytes are never returned as a successful download.

Storage failures retain the existing HTTP 502 responses: `imported_pdf_unavailable`, `imported_isdoc_unavailable`, `issued_pdf_unavailable`, or `issued_isdoc_unavailable`. Failed stored-file downloads do not regenerate issued or imported documents. Existing rendering for native invoices without a stored URL is unchanged.

The shared path preserves filenames, inline framing headers, content types, and private immutable caching. No database migration or environment configuration is required.

## Verification

`apps/web/lib/serve-invoice-file.downloads.test.ts` runs against a local HTTP fixture using native fetch. It covers stalled headers and bodies, connection closure for rejected responses, oversized chunked responses, truncated downloads, and intact versus corrupted PDF/ISDOC delivery. Deadline tests shorten the native abort timer to keep the suite fast.
