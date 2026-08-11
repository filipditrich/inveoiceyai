# 0021: Immutable imported invoice artifacts + provenance

## Status

Accepted

## Context

Invoicey issues invoices by validating `InvoiceSchema`, persisting `payload_json`, and (as of artifact persistence) uploading canonical PDF/ISDOC to UploadThing. Historical PDFs from FakturaOnline and other Czech issuers must be managed in the same list without silently replacing the original file with an Invoicey re-render.

~20% of older PDFs have no embedded ISDOC, so a full schema round-trip is impossible without OCR (explicitly out of scope for v1).

## Decision

1. Add provenance fields on `invoices` (`origin_provider`, `origin_label`, `origin_version`, `import_completeness`, `import_batch_id`, `imported_at`, `external_key`, `artifacts_immutable`).
2. Support two import completeness modes: **full** (ISDOC → `InvoiceSchema`) and **archive** (header metadata + original PDF).
3. Store the **uploaded original PDF** as `pdf_url`. When `artifacts_immutable` is set, never regenerate PDF/ISDOC via `ensureInvoiceArtifacts`.
4. Insert imported rows as already-issued with the historical number (bypass `nextInvoiceNumber`); sync numbering counters afterward.

## Consequences

- Archive rows do not pass `InvoiceSchema`; serve/download paths must branch on `import_completeness` / archive payload.
- List/dashboard use denormalized header columns (already present), so archive rows still appear in filters and totals.
- Users keep legal/visual fidelity of third-party PDFs at the cost of incomplete line-item data for archive imports.
