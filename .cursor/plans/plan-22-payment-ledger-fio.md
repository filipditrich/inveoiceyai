# Plan — Payment ledger and Fio bank integration

**Status:** Implemented; real Fio pilot pending

**ADR:** [0029](../../docs/decisions/0029-payment-ledger-fio-first.md) · [spec](../../docs/specs/payment-ledger-fio.md)

## Goal

Reconcile future Invoicey invoice payments received into a Fio account through
a provider-neutral, auditable payment ledger. Start with human-confirmed matches
and preserve a clean adapter boundary for later banks and statement imports.

## Delivery order

### Plan 22a — Live Fio contract probe

- [x] Pilot user confirms account scope/currency, issuer, and history start
- [x] Resolve Filip Ditrich / IČO 09870113 in the workspace for
      `filip.ditrich@gmx.us`; create the issuer only if absent
- [x] Add minimal workspace-scoped connection/account schema and token encryption
- [x] Add the write-only Settings → Bank connections Fio token form
- [x] Authenticated server-side probe uses the submitted monitoring token and
      explicit dates; plaintext is never returned or committed
- [ ] Redacted field-coverage report and representative fixtures are captured
- [ ] Token activation, expiry display, recent movement latency, empty response,
      sparse fields, errors, and reversal clues are documented
- [ ] No token, account secret, or unredacted transaction data enters git/logs

**Gate:** Do not finalize the adapter parser or transaction persistence mapping
until the real-account probe confirms the documented JSON contract.

### Plan 22b — Ledger and matcher foundation

- [x] Add transaction, proposal, allocation, and audit schema with workspace
      isolation and idempotency constraints
- [x] Add issued invoice payment IBAN/VS read-model fields and safe backfill
- [x] Migrate existing `paid_at` rows to idempotent legacy manual allocations
- [x] Route manual mark/unmark behavior through allocation services
- [x] Derive received/outstanding/unpaid/partial/paid/overpaid values and maintain
      `paid_at` compatibility transactionally
- [x] Implement versioned deterministic matcher with reason/blocker codes
- [ ] Cover concurrency, split, partial, overpayment, reversal, migration, and
      workspace-isolation cases with tests
- [ ] Update status, DB, architecture, and MCP/email docs for the new source of
      truth

**Gate:** Ledger and matcher tests pass using provider-neutral fixtures before
the production Fio adapter can mutate persisted transaction state.

### Plan 22c — Encrypted Fio connector and sync

- [x] Implement Fio JSON adapter and strict parser from redacted fixtures
- [x] Complete token rotation, keyed fingerprinting, account/issuer verification,
      and log/error redaction around the Plan 22a connection foundation
- [x] Implement lease-protected explicit-range sync with overlap and idempotent
      movement inserts; never use `/last` for normal sync
- [x] Add connection-date start, manual sync, scheduled polling, backoff, and
      user-visible degraded states (pilot requested no historical backfill)
- [ ] Verify new base URL, 30-second per-token throttle, 50,000-movement limit,
      and history authorization behavior
- [ ] Add integration tests with a fake Fio HTTP boundary and one controlled live
      smoke test

**Gate:** Repeated and failed syncs cannot lose or duplicate movements, and no
secret is observable outside the provider boundary.

### Plan 22d — Reconciliation UI and pilot hardening

- [x] Ship Settings → Bank connections with connect/rotate/revoke/status
- [ ] Ship Payments queue/detail with explanations, reject/rematch, split, and
      unallocated remainder
- [x] Add invoice payment summary/timeline and allocation reversal UX
- [x] Update invoice list/dashboard outstanding totals and partial/overpaid state
- [x] Trigger payment-received email once on transition to fully paid
- [ ] Add workspace permission checks, audit view, feature flag, and redacted
      operational metrics
- [ ] Complete the real future-invoice Fio pilot and rerun idempotency checks
- [ ] Resolve all `TODO(plan-22*)` items in the specification

**Gate:** Keep automatic confirmation disabled. A later decision may consider it
only after measured pilot reliability and reversal recovery.

## Verification

For every sub-plan:

- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run test`
- [ ] relevant web build and Playwright flows
- [ ] Markdown/Prettier checks for touched docs
- [ ] no secrets or unredacted account/transaction fixtures in the diff

Before commit/PR, run the repository's deslop pass and review migration SQL
manually. Apply production schema changes through explicit checked-in SQL; do
not run unattended `db:push` against production.
