# Invoice historical import

## Goal

Bulk-import previously issued invoices (PDF) into a workspace so Invoicey can manage the full history — including documents originally issued outside Invoicey.

## Surface

- **Web only:** `/invoices/import`
- No MCP / Eve / Slack import tools in v1

## Modes

| Mode      | When                            | What is stored                                                                                 |
| --------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `full`    | Embedded or sidecar ISDOC found | Validated `InvoiceSchema` in `payload_json`, line items, original PDF + extracted ISDOC URLs   |
| `archive` | No ISDOC                        | `ArchiveInvoicePayload` (`kind: "archive"`), synthetic single line item, **original PDF only** |

## Provenance columns (`invoices`)

- `origin_provider` — `invoicey` \| `fakturaonline` \| `idoklad` \| `fakturoid` \| `pohoda` \| `money_s3` \| `vyfakturuj` \| `superfaktura` \| `custom`
- `origin_label` / `origin_version`
- `import_completeness` — `full` \| `archive` (null = native Invoicey issue)
- `import_batch_id`, `imported_at`, `external_key`
- `artifacts_immutable` — `1` for imports; `ensureInvoiceArtifacts` must never regenerate over originals

## Flow

Web UI is a three-step wizard on `/invoices/import` (same route, client step state):

1. **Nastavení** — pick issuer; set batch default origin / label / version and default paid
2. **Nahrání** — UploadThing `importedInvoicePdf` (up to 40 per drop, 16 MB)
3. **Kontrola** — review grid + commit

Server classifies each PDF (`extractIsdocFromPdf` → `parseIsdoc` or archive stub) and runs `detectInvoiceOrigin`.

### Provenance on commit

- Each review row has its own **Zdroj** (seeded from `detectedOrigin.provider`).
- Batch origin is the **fallback** when a row stays `custom`, and supports “apply default to all”.
- If the user has not manually changed the batch select, classify sets it from the **majority** non-`custom` detected provider among newly uploaded rows.
- Commit writes per-item `origin` into `insertIssuedImport` (issued, historical `issuedAt`, no numbering allocation) + numbering counter sync.

## Idempotency

`external_key`:

- `isdoc:{uuid}` when ISDOC UUID present
- else `num:{provider}:{number}:{issueDate}`

Collisions on `external_key` or `(issuer_id, number)` → skip (report in summary). No replace in v1.

### Clients

Import reuses existing workspace clients instead of inserting one row per invoice:

1. Prefer `preferredId` only when that client id already exists in the workspace
2. Else match by normalized IČO (digits only)
3. Else (no IČO) match by normalized name
4. Else insert a new client

Rows created/updated by import use `source: import` (not a live ARES lookup). Partial unique index `clients_workspace_ico_uidx` guards `(workspace_id, snapshot.ico)` when IČO is present — run **Sloučit duplicity** on `/clients` (or otherwise clean dupes) before applying the index in production.

## Artifacts

Imported rows set `pdf_url` to the **uploaded original**. Downloads proxy that URL. Archive rows without `isdoc_url` hide / 404 ISDOC download.

## Non-goals (v1)

- AI/OCR for non-ISDOC PDFs
- Received (purchase) invoices
- MCP/Slack import
- Auto-replace on number collision
