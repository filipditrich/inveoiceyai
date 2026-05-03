# Plan 03 — PDF + QR + ISDOC

**Roadmap:** [Plan 3 in docs/roadmap.md](../docs/roadmap.md)

## Doc inputs

- [`docs/specs/pdf-rendering.md`](../docs/specs/pdf-rendering.md)
- [`docs/specs/spayd-qr.md`](../docs/specs/spayd-qr.md)
- [`docs/specs/isdoc.md`](../docs/specs/isdoc.md)
- [`docs/domain/invoice-schema.md`](../docs/domain/invoice-schema.md)

## Execution order

1. Specs + XSD vendoring under `packages/invoice-core/assets/schemas/`.
2. Dependencies (`@react-pdf/renderer`, `react`, `qrcode`, `xmlbuilder2`, `dejavu-fonts-ttf`, dev: `xmllint-wasm`, `@types/react`); invoice-core `tsconfig` jsx + Vitest timeouts as needed.
3. `packages/invoice-core/src/spayd/` — `buildSpaydPayload`, `renderSpaydQr`.
4. `packages/invoice-core/src/pdf/` — font registration, `loadImageForPdf` (Buffer), document component, `renderInvoicePdf`.
5. `packages/invoice-core/src/isdoc/` — `renderIsdoc` (root `version="6.0.2"`), XSD validation helper.
6. Fixtures + [`plan03-render.test.ts`](../packages/invoice-core/src/plan03-render.test.ts); export barrel `src/index.ts`.
7. Roadmap, HANDOVER, architecture todos cleared; optionally this file.

## Verification

- `bun install`
- `bun run typecheck && bun run lint && bun run test && bun run build`

## Completed (2026-05-03)

- Canonical invoices under `src/__fixtures__/invoices/`; ISDOC validates against bundled 6.0.2 XSD; PNG `<Image>` uses Buffer for fetched assets; DejaVu TTF avoids WOFF/fontkit sizing issues under react-pdf.
