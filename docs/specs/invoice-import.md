# Invoice historical import

## Goal

Bulk-import previously issued invoices (PDF) into a workspace so Invoicey can manage the full history — including documents originally issued outside Invoicey.

## Surface

- **Web only:** `/invoices/import`
- No MCP / Eve / Slack import tools in v1

## Modes

| Mode | When | What is stored |
| --- | --- | --- |
| `full` | Embedded or sidecar ISDOC found | Validated `InvoiceSchema` in `payload_json`, line items, original PDF + extracted ISDOC URLs |
| `archive` | No ISDOC | `ArchiveInvoicePayload` (`kind: "archive"`), synthetic single line item, **original PDF only** |

## Provenance columns (`invoices`)

- `origin_provider` — `invoicey` \| `fakturaonline` \| `idoklad` \| `fakturoid` \| `pohoda` \| `money_s3` \| `vyfakturuj` \| `superfaktura` \| `custom`
- `origin_label` / `origin_version`
- `import_completeness` — `full` \| `archive` (null = native Invoicey issue)
- `import_batch_id`, `imported_at`, `external_key`
- `artifacts_immutable` — `1` for imports; `ensureInvoiceArtifacts` must never regenerate over originals

## Flow

1. Pick issuer (workspace business that issued the PDFs)
2. Set batch defaults (origin provider, paid?)
3. Upload PDFs via UploadThing `importedInvoicePdf` (up to 40 per drop, 16 MB)
4. Server classifies: `extractIsdocFromPdf` → `parseIsdoc` or archive stub
5. Review grid: edit archive header fields; toggle paid
6. Commit → `insertIssuedImport` (issued, historical `issuedAt`, no numbering allocation) + numbering counter sync

## Idempotency

`external_key`:

- `isdoc:{uuid}` when ISDOC UUID present
- else `num:{provider}:{number}:{issueDate}`

Collisions on `external_key` or `(issuer_id, number)` → skip (report in summary). No replace in v1.

## Artifacts

Imported rows set `pdf_url` to the **uploaded original**. Downloads proxy that URL. Archive rows without `isdoc_url` hide / 404 ISDOC download.

## Non-goals (v1)

- AI/OCR for non-ISDOC PDFs
- Received (purchase) invoices
- MCP/Slack import
- Auto-replace on number collision
