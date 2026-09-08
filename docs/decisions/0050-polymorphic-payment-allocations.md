# 0050: Payment allocations settle invoices or payment requests

## Status

Proposed

## Context

[ADR 0029](./0029-payment-ledger-fio-first.md) made confirmed allocations the
payment source of truth and demoted `invoices.paid_at` to a projection,
specifically so payment truth would live in exactly one place.

The [instant QR payment acceptance](../research/instant-qr-payment-acceptance.md)
direction introduces a **payment request**: a live ask for a specific amount
into a specific bank account, carrying its own variable symbol, which may point
at an invoice or stand alone. A standalone one settles real money against no
invoice.

Today that money has nowhere to go. Both `invoice_payment_allocations.invoice_id`
and `payment_match_proposals.invoice_id` are `NOT NULL`.

Three ways to give it a home were considered:

1. Make the allocation target polymorphic.
2. Put settlement fields directly on the payment request.
3. Materialize a receipt or invoice at settlement so the existing ledger is
   untouched.

Option 2 is the cheapest to build and the most dangerous to live with: it
creates a second payment truth one release after ADR 0029 went to the trouble of
establishing a single one. Its failure mode is quiet — money arrives, is
confirmed, and is simply absent from revenue reporting, because a reporting
query remembered invoices and forgot the other table.

Option 3 fabricates documents nobody asked for. If the materialized document is
an invoice, an informal "pay me 500" consumes a number out of a sequence that
carries legal meaning and is governed by [ADR 0013](./0013-configurable-per-issuer-numbering.md).

## Decision

- Allocations may settle **either** an invoice **or** a payment request, never
  both and never neither. Enforce this with a database `CHECK`, not convention.
- `invoice_payment_allocations.invoice_id` becomes nullable, gains a sibling
  `payment_request_id`, and the table is renamed to `payment_allocations`.
  The same applies to `payment_match_proposals`.
- Reversal, audit, and idempotency keep exactly one implementation. A payment
  request settlement is reversed by the same path as an invoice allocation.
- Settling a payment request does **not** create an invoice, a proforma, or a
  receipt, and never consumes an invoice number. Issuing a document afterwards
  stays a separate, explicit user action.
- Revenue and cash-basis reporting read allocations, not invoices. Any report
  that joins through `invoice_id` must be revisited as part of this change
  rather than left to fail silently on the new rows.

## Consequences

- Every existing query assuming a non-null `invoice_id` must be audited. That
  audit is the real cost of this decision and is not optional.
- The rename touches migrations, Drizzle schema, and call sites. It is accepted
  deliberately: a table named `invoice_payment_allocations` that holds
  invoice-free money would misinform every future reader.
- `invoices.paid_at` / `paid_amount` / `payment_state` projections are
  unaffected — a payment request has no such projection to maintain, and its
  own status is derived from its allocations the same way.
- Because Plan 22's staging ships the invoice-linked payment request first, this
  migration is not needed to prove the live payment loop. It is decided now
  precisely because deciding it later, under delivery pressure, is how option 2
  wins by default.

## References

- [Instant QR payment acceptance research](../research/instant-qr-payment-acceptance.md)
- [ADR 0029 — provider-neutral payment ledger with Fio first](./0029-payment-ledger-fio-first.md)
- [Payment ledger and Fio specification](../specs/payment-ledger-fio.md)
