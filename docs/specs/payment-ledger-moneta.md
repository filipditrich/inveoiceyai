# Payment ledger — MONETA adapter

**Status:** Implemented  
**Decision:** [ADR 0030](../decisions/0030-moneta-second-adapter.md)  
**Sibling:** [Payment ledger + Fio](./payment-ledger-fio.md)

## Goal

Import read-only MONETA Money Bank credits into the same provider-neutral
payment ledger used by Fio, with identical matching and optional exact
auto-confirm.

## Auth and product constraints

| Topic               | Behaviour                                                          |
| ------------------- | ------------------------------------------------------------------ |
| Credential          | Account-holder API token from Internet Banka → API tokeny          |
| Storage             | Encrypted at rest (`BANK_TOKEN_ENCRYPTION_KEY_V1`), never returned |
| Rights              | Passive / AISP only — no payment initiation                        |
| Token lifetime      | Up to 90 days; renew in IB (auto-extend option exists in bank UI)  |
| History             | Max 90 days                                                        |
| Currency            | CZK accounts only                                                  |
| Workspace ownership | Connection belongs to the workspace; IBAN unique across workspaces |

## VIP AISP contract

Base URL: `https://api.moneta.cz`

| Operation     | Method / path                                        |
| ------------- | ---------------------------------------------------- |
| List accounts | `GET /api/v4/vip/aisp/my/accounts`                   |
| Transactions  | `GET /api/v4/vip/aisp/my/accounts/{id}/transactions` |

Headers:

- `Authorization: Bearer {token}`
- `Accept: application/json`
- `application_name: Invoicey`

Transaction date query params (single helper in `@invoicey/payment-core`):

- `fromDate`, `toDate` (ISO `YYYY-MM-DD`)
- `pageNumber` — walk until `pageCount`

### Normalization

| VIP field                            | Ledger field              |
| ------------------------------------ | ------------------------- |
| Account `id`                         | `providerAccountId`       |
| `identification.iban`                | `iban`                    |
| `servicer.bankCode` / `bic`          | bank code / BIC           |
| `entryReference`                     | `providerTransactionId`   |
| `creditDebitIndicator` CRDT/DBIT     | credit / debit            |
| `amount.value` + currency            | amount (absolute decimal) |
| `bookingDate.date`                   | `bookingDate`             |
| Creditor reference `VS:`/`KS:`/`SS:` | payment symbols           |

Credits only are persisted. Matcher version tag: `moneta-v1`.

## Connect flow

1. Admin/owner pastes token + selects issuer.
2. Optional **Discover accounts** lists CZK accounts on the token.
3. If multiple CZK accounts → user must pick `providerAccountId`.
4. If one CZK account → auto-selected.
5. Probe today’s transactions, encrypt token, upsert connection/account, update
   issuer default receiving bank snapshot.

## Sync

- Lease-protected sync (same pattern as Fio).
- Soft local throttle (~5s) plus HTTP `429` → `moneta_throttled`.
- Overlap: re-fetch from `syncCoverageThrough - 2 days` through today.
- Shared import helper writes transactions, proposals, optional auto-confirm.
- Cron `/api/cron/bank-sync` selects due `fio` **and** `moneta` connections.

## SQL

`bank_connections.provider` check widened to `IN ('fio','moneta')` via
`packages/db/sql/2026-08-15-moneta-provider.sql`.

## Code map

| Area          | Path                                                        |
| ------------- | ----------------------------------------------------------- |
| Adapter       | `packages/payment-core/src/moneta.ts`                       |
| Service       | `apps/web/lib/payments/moneta-service.ts`                   |
| Shared import | `apps/web/lib/payments/import-bank-batch.ts`                |
| Actions       | `connectMoneta` / `syncMoneta` / … in `actions/payments.ts` |
| UI            | Settings → Bank connections                                 |

## Out of scope

- PISP / payment initiation
- OAuth client-credentials developer apps
- Non-CZK accounts
- Statement file download as primary sync path
