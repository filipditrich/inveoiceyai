# Handover — Plan 3 complete → Plan 4

## Phase status

**Plan 3 (PDF + QR + ISDOC)** is **done** per [`docs/roadmap.md`](docs/roadmap.md). **Plan 4 (ARES + clients)** is **next**.

## What shipped (Plan 3)

- **Specs:** [`docs/specs/pdf-rendering.md`](docs/specs/pdf-rendering.md), [`docs/specs/spayd-qr.md`](docs/specs/spayd-qr.md), [`docs/specs/isdoc.md`](docs/specs/isdoc.md)
- **`@invoicey/invoice-core`**
  - `renderInvoicePdf`, `InvoicePdfDocument` — [`packages/invoice-core/src/pdf/`](packages/invoice-core/src/pdf/)
  - `buildSpaydPayload`, `renderSpaydQr` — [`packages/invoice-core/src/spayd/`](packages/invoice-core/src/spayd/)
  - `renderIsdoc`, `validateIsdocXml` — [`packages/invoice-core/src/isdoc/`](packages/invoice-core/src/isdoc/)
  - Fonts: **`dejavu-fonts-ttf`** npm (DejaVu Sans TTF + Bold), `Font.register` in [`register-fonts.ts`](packages/invoice-core/src/pdf/register-fonts.ts)
  - ISDOC XSD: [`packages/invoice-core/assets/schemas/isdoc-invoice-6.0.2.xsd`](packages/invoice-core/assets/schemas/isdoc-invoice-6.0.2.xsd); tests use **`xmllint-wasm`**
- **Tests:** [`packages/invoice-core/src/plan03-render.test.ts`](packages/invoice-core/src/plan03-render.test.ts) — XSD validation, ISDOC snapshots, PDF `%PDF` smoke, SPAYD + QR fingerprint
- **Fixtures:** [`packages/invoice-core/src/__fixtures__/invoices/`](packages/invoice-core/src/__fixtures__/invoices/)

## Gotchas

1. **`@react-pdf/image`:** `<Image src={…}>` for fetched logos must use **`Buffer`**, not `Uint8Array` (Uint8Arrays are routed like URLs and yield `fetch(undefined)` warnings). Implemented in [`load-image.ts`](packages/invoice-core/src/pdf/load-image.ts).
2. **ISDOC root:** XSD requires **`version="6.0.2"`** on `<Invoice>`.
3. **Golden refresh:** After intentional XML/PDF output changes: `cd packages/invoice-core && bun run test -- -u`; re-run XSD validation stays mandatory.

## Verification

```bash
bun install
bun run typecheck && bun run lint && bun run test && bun run build
```

## Agent continuity

- **[`AGENTS.md`](AGENTS.md)** — workspace facts
- **Plan narratives:** [`.cursor/plans/plan-01-bootstrap.md`](.cursor/plans/plan-01-bootstrap.md), [`.cursor/plans/plan-02-invoice-core.md`](.cursor/plans/plan-02-invoice-core.md), [`.cursor/plans/plan-03-pdf-qr-isdoc.md`](.cursor/plans/plan-03-pdf-qr-isdoc.md)

## Next phase — Plan 4 (ARES + clients)

**Goal:** Client CRUD + ARES lookup — see roadmap § Plan 4.
