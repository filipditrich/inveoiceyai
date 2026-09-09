# Plan 37 — Stateless invoice render

**Status:** in progress  
**Spec:** [invoice-issue-as-service.md](../../docs/specs/invoice-issue-as-service.md)

## Goal

Bulk-render `InvoiceSchema` JSON to ISDOC.PDF without touching the product
ledger. API + paste-JSON download page.

## Order

1. `parseInvoiceRenderRequest` + unique PDF names (invoice-core)
2. `POST /api/render/invoices` (session or PAT) → PDF or ZIP
3. `/invoices/render` paste-JSON download
4. Later: larger batches / async only if 25+120s is not enough

## Out of 37

Persist, matching, Invoicey-send, Pohoda, MCP as the machine contract.
