# Handover — Plan 3 shipped; PDF design polish next

## Phase status

- **Plan 3 (PDF + QR + ISDOC)** — **Done** ([`docs/roadmap.md`](docs/roadmap.md)).
- **Roadmap sequencing:** Plan 4 is **ARES + clients**.
- **Near-term intent (session handoff):** Polish **PDF invoice layout and visual design** (typography, spacing, Czech invoice conventions); use the JSON demo route to iterate quickly. Plan 4 can follow once PDF looks production-grade-or-close.

## What shipped (Plan 3 + hardening)

- **Specs:** [`docs/specs/pdf-rendering.md`](docs/specs/pdf-rendering.md), [`docs/specs/spayd-qr.md`](docs/specs/spayd-qr.md), [`docs/specs/isdoc.md`](docs/specs/isdoc.md).
- **`@invoicey/invoice-core`**
  - `renderInvoicePdf`, `InvoicePdfDocument` — [`packages/invoice-core/src/pdf/`](packages/invoice-core/src/pdf/)
  - `buildSpaydPayload`, `renderSpaydQr` — [`packages/invoice-core/src/spayd/`](packages/invoice-core/src/spayd/)
  - `renderIsdoc`, `validateIsdocXml` — [`packages/invoice-core/src/isdoc/`](packages/invoice-core/src/isdoc/)
  - **Fonts:** vendored **`DejaVuSans.ttf`**, **`DejaVuSans-Bold.ttf`** (+ license) under [`packages/invoice-core/assets/fonts/`](packages/invoice-core/assets/fonts/); [`register-fonts.ts`](packages/invoice-core/src/pdf/register-fonts.ts) resolves paths for Bun/tooling (`import.meta.url` + `cwd` fallbacks). Do **not** assume `npm` font package paths at runtime.
  - **ISDOC XSD:** [`packages/invoice-core/assets/schemas/isdoc-invoice-6.0.2.xsd`](packages/invoice-core/assets/schemas/isdoc-invoice-6.0.2.xsd); tests validate with **`xmllint-wasm`**.
- **Tests:** [`packages/invoice-core/src/plan03-render.test.ts`](packages/invoice-core/src/plan03-render.test.ts) — XSD validation, ISDOC snapshots, PDF `%PDF` smoke, SPAYD + QR fingerprint/snapshot.

## Web demo — keep for QA / tweaking

**Do not remove** this flow when improving PDF visuals; it is the fastest iteration surface.

| Piece | Purpose |
| --- | --- |
| Route **`/invoices/from-json`** | Paste/edit invoice JSON, preview PDF |
| **`apps/web/lib/demo-sample-invoice.json`** | Loadable realistic sample (Filip Ditrich neplátce + NFCtron a.s.; bank + IBAN; useful for QR + layout checks) |
| **`POST /api/demo/invoice-pdf`** | Server builds PDF from posted JSON |
| Link from **`/invoices`** | Entry to the demo |

## Gotchas

1. **`@react-pdf/image`:** `<Image src={…}>` for fetched logos must use **`Buffer`**, not `Uint8Array` (Uint8Arrays are treated like URLs → bad fetches). See [`load-image.ts`](packages/invoice-core/src/pdf/load-image.ts).
2. **Tiny PNG logos:** images with IHDR **w,h ≤ 4** are skipped (avoids 1×1 “logo” blowing up to a black block).
3. **ISDOC root:** XSD requires **`version="6.0.2"`** on `<Invoice>`.
4. **SPAYD `AM`:** amount is in **koruny (major units)** — e.g. `1210` or `99.50` — **not** haléře. Implemented in [`build-spayd-payload.ts`](packages/invoice-core/src/spayd/build-spayd-payload.ts) via `formatSpaydAmCz`. After changing SPAYD: refresh golden expectations / QR snapshot — `cd packages/invoice-core && bun run test -- -u`.
5. **Golden refresh:** After intentional XML/PDF/QR output changes: `cd packages/invoice-core && bun run test -- -u`; XSD validation must stay green.

## Recent commits (local `main`, may need `git push`)

Chronological head of stack (newest first):

- `fix(invoice-core,web): spayd amount in koruny and refresh demo invoice`
- `fix(web,invoice-core): widen pdf demo preview and omit tiny png logos`
- `fix(invoice-core): vend dejavu fonts for reliable pdf loading`
- `feat(web): add invoice-from-json demo for pdf preview`
- `feat(invoice-core): add pdf, spayd qr, and isdoc export`

## Verification

```bash
bun install
bun run typecheck && bun run lint && bun run test && bun run build
```

## Next session — PDF shape / design (suggested order)

1. Read [`docs/specs/pdf-rendering.md`](docs/specs/pdf-rendering.md) and current layout in [`packages/invoice-core/src/pdf/`](packages/invoice-core/src/pdf/) (document component + styles).
2. Iterate with **`bun dev`** → **`/invoices/from-json`** and the sample JSON; confirm QR amount matches invoice total in a banking app.
3. Add or extend visual regression only if the repo already has a pattern; otherwise rely on PDF smoke + manual preview until Plan 9 polish.
4. After PDF work stabilizes, resume roadmap **Plan 4 (ARES + clients)** per [`docs/roadmap.md`](docs/roadmap.md).

## Agent continuity

- **[`AGENTS.md`](AGENTS.md)** — workspace facts.
- **Plan narratives:** [`.cursor/plans/plan-01-bootstrap.md`](.cursor/plans/plan-01-bootstrap.md) … [`.cursor/plans/plan-03-pdf-qr-isdoc.md`](.cursor/plans/plan-03-pdf-qr-isdoc.md).
