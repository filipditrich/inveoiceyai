# 0030: MONETA as second read-only bank adapter

## Status

Accepted

## Context

Plan 22 shipped a provider-neutral payment ledger with Fio as the first
read-only adapter ([ADR 0029](./0029-payment-ledger-fio-first.md)). Research
identified MONETA Money Bank as the closest Fio-like second provider: free
account-holder API, pasteable token from Internet Banka, VIP AISP endpoints for
balances and transaction history, and a developer sandbox.

Users need more than one Czech bank feed without changing the ledger model.
MONETA tokens expire within 90 days and history is capped at 90 days — product
constraints that Fio does not share — but the connect/sync/match surface can
stay the same.

## Decision

- Add MONETA as a second **read-only** adapter using the account-holder Bearer
  token (VIP AISP). Do not register an Invoicey OAuth application or support
  payment initiation (PISP).
- Keep the ledger, matcher, allocations, and encryption helpers provider-neutral.
  Persist `provider = 'moneta'` on connections, accounts, and transactions.
- Allow one active Fio connection and one active MONETA connection per
  workspace (still one IBAN globally across workspaces).
- When a token covers multiple CZK accounts, require the user to pick one before
  connect; auto-select when exactly one CZK account is present.
- Poll with explicit overlapping date ranges, paginate VIP transaction pages,
  import credits only, and dedupe by `entryReference`.
- Surface token renewal and 90-day history limits in Settings and product docs.
- Share the import/match/auto-confirm path between Fio and MONETA so matcher
  behaviour stays identical (`moneta-v1` / `fio-v1` version tags only).

## Consequences

- Cron `/api/cron/bank-sync` dispatches by provider.
- Settings → Bank connections lists both providers and shows MONETA connect when
  no active MONETA connection exists.
- Operators must renew MONETA tokens periodically or syncs fail with
  `moneta_unauthorized`.
- Further banks remain deferred unless they match the pasteable-token model.

## Plans touched

- Plan 23 — MONETA read-only adapter (full Fio parity)

## References

- [Payment ledger MONETA specification](../specs/payment-ledger-moneta.md)
- [Payment ledger and Fio specification](../specs/payment-ledger-fio.md)
- [ADR 0029](./0029-payment-ledger-fio-first.md)
- [Bank integration research](../research/payment-ledger-bank-integration.md)
- [MONETA API](https://www.moneta.cz/zivnostnici-a-firmy/api)
