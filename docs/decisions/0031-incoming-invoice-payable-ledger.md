# 0031: Incoming invoices as a first-class payable domain

## Status

Accepted

## Context

Invoicey models one direction of trade: invoices this workspace **issues**, the
clients it issues them to, and the **credits** that settle them. Supplier
invoices — přijaté faktury — have no representation at all.

The obvious shortcuts are both wrong:

- **Reusing `invoices` with a direction flag.** The issued-invoice row is built
  around facts Invoicey controls: a numbering scheme it assigns, an issuer
  snapshot it owns, a rendered PDF/ISDOC artifact it produced, a status derived
  from `issuedAt` / `dueDate` / `cancelledAt`. A received invoice controls none
  of these. Its number belongs to the supplier, its document is an opaque
  original we must never regenerate, and its lifecycle is about _review and
  authorization_, not _issue and send_. Every downstream query — numbering,
  dashboards, list filters, PDF rendering, ISDOC export, recurring schedules,
  the MCP tool surface — would need a direction predicate, and one missing
  predicate leaks a supplier's invoice into the user's own sales figures.
- **Reusing `clients` as the supplier master.** A client row is snapshotted into
  issued invoices at issue time (ADR 0008) and is deduplicated by IČO per
  workspace. A supplier needs facts a client does not have — every beneficiary
  account ever seen on its invoices, payment terms, an approval profile — and
  the two roles genuinely differ even when the same IČO fills both.

At the same time, the payment half of this problem is _already solved_ in the
codebase and must not be forked: `bank_connections`, `bank_accounts`,
`bank_transactions`, the deterministic matcher, the allocation ledger, and
`payment_audit_events` were all built provider-neutral by ADR 0029.

## Decision

- Model incoming invoices as their own domain: `incoming_invoices`,
  `incoming_invoice_lines`, `incoming_documents`, `inbox_items`, `suppliers`,
  `supplier_bank_accounts`. Workspace-scoped like everything else (ADR 0007).
- **The receiving legal entity is an existing `issuer_businesses` row.** A
  workspace already supports several issuers; a received invoice is addressed to
  one of their IČOs. No new legal-entity table is introduced, and multi-entity
  works on day one because it is the same mechanism the issued side uses.
- **Suppliers are a separate master from clients**, keyed by normalized IČO per
  workspace with the same partial-unique-index pattern `clients` uses, and an
  optional `client_id` link when the same IČO is both. Beneficiary accounts are
  their own rows so "an account we have never paid before" is a queryable fact.
- **Reuse the payment ledger rather than mirroring it into a new one.** Debits
  are persisted into the existing `bank_transactions` table (the `direction`
  column already distinguishes them; today's import filters credits only), the
  payables matcher lives beside the receivables matcher in
  `@invoicey/payment-core`, and `payment_audit_events` carries the audit trail
  for the new entity types unchanged.
- Add **one** new ledger table, `payable_payment_allocations`, mirroring
  `invoice_payment_allocations` field for field. A single polymorphic allocation
  table would trade two clean foreign keys for a nullable pair plus a check
  constraint, and every existing query would have to learn a discriminator.
- **Lifecycle status and payment state are separate columns**, consistent with
  ADR 0014 and Plan 22. `status` covers review and authorization
  (`needs_review` → `accepted` → `pending_approval` → `approved`, plus
  `extract_failed`, `on_hold`, `rejected`, `cancelled`); `payment_state`
  (`unpaid` / `partial` / `paid` / `overpaid`) is derived from active
  allocations and never set by hand.
- **An inbox item is not an invoice.** One inbound message may carry several
  invoices, or none. Classification happens at document level, and a document
  classified as a statement, reminder, contract, or spam is stored and parked —
  it never enters the review queue as an invoice.
- **Money stays `numeric(_, 2)` strings** with minor-unit arithmetic in
  `@invoicey/payment-core`, matching every existing money column. Consistency
  with the ledger the payables side allocates against outweighs the theoretical
  appeal of integer columns.
- **Extraction never produces a trusted record.** ISDOC input is deterministic
  and may pre-fill everything; AI extraction produces a proposal with per-field
  confidence that a person confirms. `extraction_source` is persisted on every
  row so a reader can always tell which one it was.
- **Hard duplicate identity** is `(workspace_id, issuer_id, supplier_id,
normalized number)` on non-cancelled rows, enforced by a partial unique index
  rather than only in application code. File identity is `sha256`: the same
  bytes arriving twice attach to the existing invoice.
- Originals are immutable and retained: `sha256` on every stored document and a
  `retain_until` date on the invoice, computed as the end of the tax period plus
  ten years (§ 35 zákona o DPH). Deleting an invoice never deletes its document.

## Consequences

- The dashboard and the invoice list keep their current meaning; nothing on the
  issued side changes shape.
- `bank_transactions` starts holding debits for accounts whose `import_scope`
  allows it. Existing receivables matching is unaffected because it already
  filters on `direction = 'credit'`.
- Two matchers and two allocation tables must be kept behaviourally in step;
  they share money helpers, reason/blocker vocabulary, and projection logic, and
  a divergence between them is a bug.
- A workspace that is both a customer and a supplier of the same company gets
  two master rows. The `client_id` link makes that visible and joinable; it is
  not deduplicated away.
- Retention means storage grows monotonically and "delete my data" cannot be
  absolute for documents that are still inside their retention window. This must
  be stated in the privacy copy.
- Multi-entity routing depends on an ISDOC customer IČO — or a per-issuer mail
  alias — resolving to exactly one issuer. Anything else is an explicit
  exception, not a guess.

## Plans touched

- Plan 24a — domain foundation, upload, ISDOC, accept gate
- Plan 24b — inbound mail capture
- Plan 24c — AI extraction and validation
- Plan 24d — approval rules
- Plan 24e — payables, payment runs, debit reconciliation

## References

- [Incoming invoices specification](../specs/incoming-invoices.md)
- [Incoming invoices research](../research/incoming-invoices.md)
- [0029 — provider-neutral payment ledger with Fio first](./0029-payment-ledger-fio-first.md)
- [0021 — immutable imported invoice artifacts](./0021-immutable-imported-invoice-artifacts.md)
- [0014 — invoice status is derived, not stored](./0014-status-derived-not-stored.md)
- [0007 — workspace-scoped data model](./0007-workspace-scoped-data-model.md)
