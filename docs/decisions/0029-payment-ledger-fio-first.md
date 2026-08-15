# 0029: Provider-neutral payment ledger with Fio first

## Status

Accepted

## Context

Invoicey currently stores `invoices.paid_at` as a binary payment fact. That is
not sufficient for partial payments, one transfer covering multiple invoices,
overpayments, reversals, or evidence from a bank transaction.

The first real user of bank matching will receive future invoice payments into
a Fio account. Fio offers a self-service monitoring token and a free proprietary
API, so it can validate live reconciliation without first taking on a licensed
multibank provider contract.

Writing a Fio result directly to `invoices.paid_at` would couple the invoice
lifecycle to one bank, make ambiguous matches look authoritative, and prevent a
later multibank adapter from using the same reconciliation model.

## Decision

- Add a workspace-scoped, provider-neutral payment ledger before connecting a
  bank.
- Treat the connection and its bank data as workspace-owned. User IDs record
  authorization and audit actors; they do not own a reusable cross-workspace
  credential. A multi-workspace user connects accounts separately in each
  active workspace.
- Allow one provider account/IBAN in only one active workspace in Plan 22 to
  prevent duplicate ingestion and cross-workspace disclosure. The account may
  serve multiple issuers inside that workspace.
- Persist normalized bank transactions separately from suggested matches and
  confirmed invoice allocations.
- Treat confirmed allocations as the payment source of truth. Maintain
  `invoices.paid_at` transactionally as a compatibility projection when active
  allocations first cover the absolute settlement target.
- Keep matching deterministic and explainable. Fio transactions only create
  proposals in the first release; a person confirms the allocation.
- Implement Fio as the first read-only adapter using a monitoring-only token.
  Payment initiation is a separate future capability.
- Poll Fio with explicit, overlapping date ranges and deduplicate by provider
  movement ID. Do not use Fio's bank-side `/last` cursor for normal sync because
  it advances when the response is returned, before Invoicey can commit it.
- Keep adapter contracts independent of Fio so statement import and a future
  multibank provider feed the same normalized transaction and allocation model.
- Do not support foreign-exchange allocation in this phase. Transaction,
  allocation, and invoice currency must agree.

## Consequences

- Manual mark-paid actions must create or reverse ledger allocations instead of
  updating `paid_at` alone.
- Existing paid invoices need an idempotent migration to legacy manual
  allocations.
- The invoice read model gains payment account and variable-symbol facts needed
  for indexed matching.
- Partial and overpaid states can be shown without mutating issued invoice
  totals or artifacts.
- Fio tokens become high-sensitivity credentials: they are encrypted at rest,
  never returned after submission, never logged, and revocable independently.
- Fio's token lifetime, 30-second per-token request interval, lack of a sandbox,
  and temporary authorization for history older than 90 days become explicit
  product and operational constraints.

## Plans touched

- Plan 22a — live Fio contract probe
- Plan 22b — ledger and deterministic matcher
- Plan 22c — encrypted Fio connection and sync
- Plan 22d — reconciliation UI and pilot hardening

## References

- [Payment ledger and Fio specification](../specs/payment-ledger-fio.md)
- [Payment ledger and bank integration research](../research/payment-ledger-bank-integration.md)
  (includes 2026-08-15 Czech bank/fintech API matrix; further direct adapters deferred)
- [Status engine](../domain/status-engine.md)
- [Fio API technical documentation](https://www2.fio.cz/docs/cz/API_Bankovnictvi.pdf)
