# Plan — MONETA read-only bank adapter

**Status:** Implemented  
**ADR:** [0030](../../docs/decisions/0030-moneta-second-adapter.md) · [spec](../../docs/specs/payment-ledger-moneta.md)

## Goal

Ship MONETA Money Bank as a second read-only feed with full Fio parity on the
provider-neutral payment ledger.

## Delivery checklist

- [x] Widen `BankProvider` and add VIP AISP adapter + unit tests
- [x] SQL `provider IN ('fio','moneta')` record
- [x] Shared import/match path; `moneta-service` connect/sync/auto-match/delete
- [x] Server actions + multi-provider cron dispatch
- [x] Settings UI (connect, manage, logos, Switch, status badge)
- [x] ADR 0030 + Moneta spec + product/research docs

## Gate

Apply `packages/db/sql/2026-08-15-moneta-provider.sql` on each environment
before deploying a build that inserts `provider = 'moneta'`.
