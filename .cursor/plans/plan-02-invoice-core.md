# Plan 02 — `invoice-core` domain package

**Roadmap:** [Plan 2 in docs/roadmap.md](../docs/roadmap.md)

## Doc inputs

- [`docs/domain/invoice-schema.md`](../docs/domain/invoice-schema.md)
- [`docs/domain/vat-czech.md`](../docs/domain/vat-czech.md)
- [`docs/domain/numbering.md`](../docs/domain/numbering.md)
- [`docs/domain/status-engine.md`](../docs/domain/status-engine.md)

## Execution order

1. `packages/invoice-core/src/schema.ts` — Zod schemas + cross-field refinements (credit notes: negative line/totals).
2. `totals.ts` — `round2`, `calcTotals(items, vat, issuerVatPayer)`; per-rate VAT breakdown + line reconciliation.
3. `numbering.ts` — `nextInvoiceNumber(scheme, issueDate)`; tokens `{YYYY}`, `{YY}`, `{MM}`, `{DD}`, `{#+}`, `{ISSUER}`, `{TYPE}`; yearly reset.
4. `status.ts` — `deriveStatus(facts, now)`; `Europe/Prague` end of due date (`date-fns-tz`).
5. Vitest colocated tests; root `bun run test` + Turbo `test` task.

## Verification

- `bun install`, `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`.

## Completed (2026-05-03)

- Pure domain package implemented; no UI/PDF/DB.
- Open questions in `invoice-schema.md` for credit-note sign + rounding updated to match implementation.
- GitHub Actions skipped by preference; tests run locally via Turbo.
