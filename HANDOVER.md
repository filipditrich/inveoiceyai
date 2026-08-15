# Handover — Plan 22 payment ledger + Fio shipped; pilot pending

## Phase status

| Area                               | Status                                  |
| ---------------------------------- | --------------------------------------- |
| Plans 0–9 (MVP UI)                 | Done                                    |
| Plans 10–12, 14, 16–21             | Done                                    |
| Plan 13b (Eve Slack)               | In progress                             |
| **Plan 22 (payment ledger + Fio)** | **Implemented; real Fio pilot pending** |

Living ledger: [`docs/roadmap.md`](docs/roadmap.md). Repo overview: [`README.md`](README.md). Product docs: `apps/web/content/docs/` → `/docs`.

## What shipped recently (payments)

- **`@invoicey/payment-core`** — Fio periods adapter, deterministic matcher, money helpers.
- **Ledger tables** — bank connections/accounts, transactions, match proposals, allocations, audit.
- **Settings → Bank connections** — encrypted Fio monitoring token, sync now, disconnect.
- **Payments** (`/payments`) — confirm/reject proposals, manual payments, recent Fio credits.
- **Invoice payment state** — allocations drive `paid_amount` / `payment_state` / `paid_at` projection.
- **Cron** — `/api/cron/bank-sync` (needs `CRON_SECRET` + `BANK_TOKEN_ENCRYPTION_KEY_V1`).

Spec: [`docs/specs/payment-ledger-fio.md`](docs/specs/payment-ledger-fio.md) · ADR: [`0029`](docs/decisions/0029-payment-ledger-fio-first.md).

## Gotchas

1. PDF needs Node `Buffer` for images — never Edge for render routes.
2. Fonts: `outputFileTracingIncludes` in `apps/web/next.config.ts` for `invoice-core` assets.
3. Issuer on MCP/Eve is **locked** server-side (preset / workspace default issuer).
4. Prod schema changes go through checked-in SQL under `packages/db/sql/` — do not unattended `db:push` against production.
5. Fio tokens are never returned to the client; encryption key must be set before connect.

## Verification

```bash
bun install
bun run typecheck && bun run lint && bun run test && bun run build
```

## Next session — pick a track

**A — Plan 22 pilot**  
Complete real monitoring-token probe, rematch/split UI, and idempotent sync validation.

**B — Eve Slack (13b)**  
Continue agent HITL / persistence polish ([`docs/specs/slack-eve.md`](docs/specs/slack-eve.md)).

**C — Docs drift**  
Keep root README, `docs/`, and `apps/web/content/docs/` aligned when behavior changes.

## Agent continuity

- [`AGENTS.md`](AGENTS.md) — prefs + workspace facts
- Plans: [`.cursor/plans/`](.cursor/plans/)
