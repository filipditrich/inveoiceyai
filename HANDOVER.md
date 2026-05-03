# Handover — Plan 2 complete → Plan 3

## Phase status

**Plan 2 (`invoice-core`)** is **done** per [`docs/roadmap.md`](docs/roadmap.md): exit criteria checked; timeline shows Plan 3 as **next**.

## What shipped (Plan 2)

- **`packages/invoice-core`:** [`schema.ts`](packages/invoice-core/src/schema.ts) (Zod contract + refinements), [`totals.ts`](packages/invoice-core/src/totals.ts) (`round2`, `calcTotals`), [`numbering.ts`](packages/invoice-core/src/numbering.ts) (`nextInvoiceNumber`, `slugifyIssuerName`), [`status.ts`](packages/invoice-core/src/status.ts) (`deriveStatus`, Prague end-of-day).
- **Tests:** [`invoice-core.test.ts`](packages/invoice-core/src/invoice-core.test.ts) (Vitest).
- **Root:** `bun run test` → Turbo `test` (only workspaces that define `test` run it, e.g. `@invoicey/invoice-core`).
- **CI:** GitHub Actions intentionally not used for now; verify locally before commit.

## Verification

```bash
bun install
bun run typecheck && bun run lint && bun run test && bun run build
bun dev
```

With **`DATABASE_URL`** at repo root (and under `apps/web/.env.local` once Next imports `@invoicey/db`):

```bash
bun db:push
```

## Gotchas

1. **`calcTotals` signature:** `calcTotals(items, vat, issuerVatPayer)` — third argument required so neplátce forces effective 0% VAT.
2. **`deriveStatus` input:** persisted **facts** (`InvoiceFacts`), not full `InvoiceSchema` JSON (see [`docs/domain/status-engine.md`](docs/domain/status-engine.md)).
3. **Next.js env:** Same as Plan 1 — `DATABASE_URL` in `apps/web/` when the app uses the DB package.

## Agent continuity

- **[`AGENTS.md`](AGENTS.md)** — prefs + workspace facts.
- **Plan narratives:** [`.cursor/plans/plan-01-bootstrap.md`](.cursor/plans/plan-01-bootstrap.md), [`.cursor/plans/plan-02-invoice-core.md`](.cursor/plans/plan-02-invoice-core.md).

## Next phase — Plan 3 (PDF + QR + ISDOC)

**Goal:** `renderInvoicePdf`, SPAYD payload/QR, ISDOC XML + golden tests per `docs/roadmap.md` § Plan 3.

**Read first:** Plan 3 exit criteria + domain [`docs/domain/invoice-schema.md`](docs/domain/invoice-schema.md); add specs under `specs/` before heavy implementation.

## Optional cleanup

- Remove `bootstrap_probe` once real migrations replace it (later plans).
