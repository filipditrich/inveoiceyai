# Plan — Payment requests and watch sessions

**Status:** Not started
**ADR:** [0050](../../docs/decisions/0050-polymorphic-payment-allocations.md) · [0051](../../docs/decisions/0051-payment-requests-self-settle.md) · [spec](../../docs/specs/payment-requests.md)

## Goal

Name an amount, show a QR, watch the money land. Ship the invoice-linked case
first so the live loop is proven before any money schema moves.

## Ordering

The two stages are sequenced for a reason: stage 1 answers "does 0–31 s feel
like a terminal?" for the price of a QR and a poll endpoint. If the answer is
no, stage 2's migration was never paid for.

### 36a — Invoice-linked ("collect this invoice now")

- [ ] Generalize `buildSpaydPayload` to take payment facts, not an `Invoice`.
      Keep the invoice entry point as a thin adapter over it so PDF output is
      byte-identical (`plan03-render` snapshots must not move).
- [ ] On-screen QR renderer (SVG / large), separate from the 164px PDF asset.
- [ ] Watch session state on the connection + per-provider poll floor. Fio 31 s,
      MONETA 5 s — read the interval from the provider, never a constant.
- [ ] Status endpoint: answers from the DB, requests a provider poll, returns
      either fresh state or the remaining wait. Skips are not failures.
- [ ] Cron sweep skips connections under an active watch.
- [ ] "Collect now" on invoice detail → waiting screen, reusing the invoice's
      own variable symbol and the existing settlement path.
- [ ] Waiting screen: hopeful, never accusatory. No failure state on a timer.

**Ledger change in 36a: none.** If a diff here touches
`invoice_payment_allocations`, the stage boundary has been crossed by accident.

### 36b — Standalone payment requests

- [ ] `payment_requests` table + symbol allocation with a real uniqueness query
      against open requests _and_ invoice symbols on the account.
- [ ] ADR 0050 migration: nullable `invoice_id`, `payment_request_id`, `CHECK`
      exactly one, rename to `payment_allocations`. Same for proposals.
- [ ] **Audit every query assuming a non-null `invoice_id`.** This is the real
      cost of 0050 and is not optional.
- [ ] Fix `dashboard-metrics.ts` — it inner-joins `invoices` on the allocation
      sum and would silently drop standalone settlements from revenue. Needs
      the left join _and_ the issuer coalesced from the payment request.
- [ ] Self-settlement policy (ADR 0051) as its own tested unit. Do not widen
      `isExactAutoMatchProposal`.
- [ ] The full failure table from the spec: short, over, duplicate, no-symbol,
      reversal, cancelled-then-paid.
- [ ] Create surface (dashboard + phone), list under `/payments`, public
      `public_token` page with no live state.
- [ ] Late settlements notify through the existing e-mail / Slack paths.

## Gates

- CZK only. Both connections and the SPAYD builder are CZK-only today.
- Entitlement is `features.bankConnections` — a request needs a connection, so
  no new plan flag.
- Apply the 36b SQL on every environment **before** deploying a build that
  writes a null `invoice_id`.

## Deliberately out

Open-amount QR, non-CZK, issuing a document from a settlement, Web Push, native
app, payment initiation, and the Fio e-mail doorbell. The doorbell is additive
and only worth its spoofing surface if stage 1 proves polling too slow — Fio at
31 s and MONETA at 5 s give two data points on that.

## Prerequisite — done

Cadence and rate-limit bookkeeping shipped ahead of this plan (#59): the sweep
runs every 5 minutes instead of daily, and provider throttles are skips rather
than failures, so a fast poller cannot burn the alert streak or push
`next_sync_at` out by the failure backoff.
