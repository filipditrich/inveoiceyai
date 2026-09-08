# Payment requests and watch sessions

**Status:** Specified, not started
**Decisions:** [ADR 0050](../decisions/0050-polymorphic-payment-allocations.md) · [ADR 0051](../decisions/0051-payment-requests-self-settle.md)
**Research:** [instant QR payment acceptance](../research/instant-qr-payment-acceptance.md)
**Siblings:** [payment ledger + Fio](./payment-ledger-fio.md) · [SPAYD QR](./spayd-qr.md)

## Goal

Name an amount, show a QR, and have both sides watch the same screen until the
money is confirmed present — instead of "check your bank later".

A **payment request** is a live ask for a specific amount into a specific bank
account, carrying its own variable symbol. It may point at an invoice or stand
alone. It is not a document and is never sent to an authority. A **watch
session** is the bounded window during which the connection is polled at its
maximum safe rate so the confirmation lands while someone waits.

## Staging

Two stages, deliberately ordered so the expensive migration comes after the
loop is proven.

| Stage | Scope                                              | Ledger change      |
| ----- | -------------------------------------------------- | ------------------ |
| **1** | Invoice-linked request: "collect this invoice now" | **None**           |
| **2** | Standalone request: money with no invoice          | ADR 0050 migration |

Stage 1 reuses the shipped invoice settlement path end to end, so it proves the
QR, the watch protocol, the arbitration, and the UI while touching no money
schema. Stage 2 is where `payment_allocations` and issuer-carrying come due.

## Constraints inherited from the bank layer

| Topic             | Value                                                               |
| ----------------- | ------------------------------------------------------------------- |
| Currency          | CZK only — SPAYD builder and both connections are CZK-only          |
| Fio poll floor    | 31 s per token (`fio-service.ts`)                                   |
| MONETA poll floor | 5 s per token (`moneta-service.ts`)                                 |
| Instant delivery  | ≤ 10 s by standard, usually < 3 s; **not guaranteed** to be instant |
| Instant ceiling   | 2 500 000 Kč per payment                                            |
| Provider push     | None. Both providers are pull-only                                  |
| Entitlement       | Gated by `features.bankConnections` — a request needs a connection  |

The poll interval is a **per-provider fact, never a constant**. Any code that
hardcodes 31 s is wrong for MONETA.

## Data model

### `payment_requests`

| Column               | Notes                                                          |
| -------------------- | -------------------------------------------------------------- |
| `id`                 | uuid                                                           |
| `workspace_id`       | FK, cascade                                                    |
| `issuer_id`          | FK. Carried so revenue reporting can filter without an invoice |
| `bank_account_id`    | FK. The account the money must land in                         |
| `invoice_id`         | Nullable. Set in stage 1, null for a standalone request        |
| `amount`, `currency` | `numeric(18,2)`, CZK                                           |
| `variable_symbol`    | Generated, unique per bank account (see below)                 |
| `message`            | Optional payer-facing note, SPAYD `MSG`                        |
| `status`             | `open` \| `settled` \| `cancelled`                             |
| `public_token`       | Random, for the shareable page. Not the id                     |
| `created_by_user_id` | FK                                                             |
| `settled_at`         | Set when allocations first cover the amount                    |
| `stale_after`        | Display-only; never stops matching                             |

Uniqueness: `(bank_account_id, variable_symbol)`.

### Variable symbol allocation

- 10 digits, numeric: leading `9`, then 9 random.
- The `9` prefix is a **convention, not a guarantee** — issuer numbering
  templates are user-configurable, so a `9`-prefixed invoice number is
  possible. Generation must run a real uniqueness query against open requests
  **and** invoice `payment_variable_symbol` on that account, and retry.
- Never reused, including after cancellation.
- Randomness is deliberate: a payer's typo must land on nothing rather than on
  someone else's open request, which is the failure that cannot be detected.
- Reuse `invoicePaymentIdentifiers` normalization rather than adding a second
  digit-stripping rule.

## Settlement policy

Per [ADR 0051](../decisions/0051-payment-requests-self-settle.md), a payment
request self-settles on exact symbol + exact amount + expected receiving
account, **without** consulting `autoConfirmExactMatches`. That flag governs
inference about invoice payments; here there is nothing to infer.

Implement as a policy distinct from `isExactAutoMatchProposal`. Do not widen
the invoice rule.

| Situation                             | Behaviour                                               |
| ------------------------------------- | ------------------------------------------------------- |
| Exact symbol + exact amount, open     | Settle, surface live                                    |
| Exact symbol, amount short            | "Received X of Y", stay open — never round up to paid   |
| Exact symbol, amount over             | Settle, flag the overpayment                            |
| Exact symbol, already settled         | Duplicate needing review. Never settle twice            |
| Right amount, no symbol, one open     | Propose with one-tap confirm. Never auto-settle         |
| Right amount, no symbol, several open | Ambiguous — propose against all, force a human choice   |
| Reversal / returned transfer          | Reverse explicitly, same path as an invoice allocation  |
| Cancelled request, money arrives      | Surface as unmatched. Cancellation must not be a delete |

Settlement is **decoupled from watching**: a qualifying credit that lands hours
after the watch session ended settles identically.

## Watch session protocol

A watch session is server state on the connection, not a socket.

1. Client opens the waiting screen; server records an active watch on the
   connection with a short TTL (~10–20 min).
2. Client polls a status endpoint every ~2–3 s.
3. The endpoint answers from the database. It **requests** a provider poll
   rather than calling sync directly, and gets back either fresh data or the
   remaining wait.
4. A provider call happens at most once per that provider's floor, regardless
   of how many clients are watching. N watchers cost one request per interval.
5. `leaseUntil` remains the mutual exclusion. Rate-limit outcomes are skips,
   never failures (`bank-sync-outcome.ts`).
6. An active watch outranks the cron sweep, which skips connections currently
   being watched — they are better covered than it could manage.

Expiry closes the **watch**, never the request.

## Surfaces

| Surface        | Behaviour                                                           |
| -------------- | ------------------------------------------------------------------- |
| Create         | Fast action from dashboard and phone. Amount, optional note         |
| Collect (S1)   | "Collect now" on invoice detail, reusing the invoice's own symbol   |
| Waiting screen | Large QR, account/symbol/amount as text, live state                 |
| Public page    | `public_token` route: same QR + copyable details. **No live state** |
| List           | Under `/payments`                                                   |
| Late arrival   | Existing e-mail / Slack DM paths. No Web Push in this plan          |

The waiting screen must be **hopeful, never accusatory**: `PT:IP` is a hint,
many bank apps expose instant payment as a checkbox the payer ticks, and a
perfectly good payment can arrive hours later as an ordinary transfer. A
"payment failed" state after 30 s would be wrong.

## Reporting

`dashboard-metrics.ts` sums allocations by month for the "paid" series but
inner-joins `invoices`, which would silently drop standalone settlements. Stage
2 must left-join and coalesce the issuer from the payment request. Settled
requests land in the **same** series as invoice payments: for cash-basis Czech
income, received money is received money.

## Out of scope

- Open-amount ("tip jar") QR — reusable symbols destroy matching; separate design.
- Non-CZK requests.
- Issuing an invoice or receipt from a settled request.
- Web Push and any native app.
- Payment initiation. Both adapters stay read-only ([ADR 0029](../decisions/0029-payment-ledger-fio-first.md)).
- The e-mail doorbell (Fio hlásič → Resend Inbound). Additive later, measured first.
