# Handover — dashboard shell landed; PDF polish / Plan 4 next

## Phase status

- **Plan 3 (PDF + QR + ISDOC)** — **Done** ([`docs/roadmap.md`](docs/roadmap.md)).
- **Roadmap sequencing:** Plan 4 is **ARES + clients**.
- **Near-term intent:** Polish **PDF invoice layout / visual design**, or resume **Plan 4** once PDF baseline is satisfactory. Optionally wire **Vercel** (install/build for Bun monorepo + smoke-test `POST /api/demo/invoice-pdf`).

## Latest session additions (dashboard + deploy notes)

### Web UX (committed on `main`)

- **Dashboard:** shadcn **dashboard-01**–style wiring on [`apps/web/app/(app)/dashboard/page.tsx`](apps/web/app/(app)/dashboard/page.tsx) — `SectionCards`, `ChartAreaInteractive`, `DataTable` + [`data.json`](apps/web/app/(app)/dashboard/data.json).
- **Product-shaped mocks:** invoice rows (`number`, `buyer`, `docType`, `status`, `total`, `dueDate`, `issuer`); KPI cards and chart copy reference invoicing (demo disclaimers kept).
- **Sidebar:** removed **NavSecondary** (template docs / unrelated links). See [`apps/web/components/app-sidebar.tsx`](apps/web/components/app-sidebar.tsx).
- **Data table:** [`apps/web/components/data-table.tsx`](apps/web/components/data-table.tsx) — Zod schema + columns + tabs (`invoices`, `overdue-queue`, `drafts`, `exports`) + drawer use invoice fields; mini-chart labels **Issued / Exported**. If you see duplicate `TableCellViewer` or missing `}` from a bad merge, see last good commit on `main`.
- **Recent commits (newest first):** `refactor(web): align dashboard mocks with invoicing domain` → `feat(web): compose dashboard page from shadcn dashboard-01 block` → `feat(web): add shadcn sidebar-16 shell and UI primitives`.

### Background task (aborted, no action needed)

- One automated `shadcn add dashboard-01` run **aborted** on interactive overwrite (`use-mobile.ts`). Dashboard files are already present from the commits above; no rerun required unless re-scaffolding.

### Vercel (not configured in-repo yet)

- No `vercel.json` committed. **Bun + Turborepo:** set project **Root Directory** / **Install** / **Build** so `bun install` runs from repo root and Next builds `apps/web` (e.g. install from parent of `apps/web`, then `turbo build` or filtered build). See prior chat for checklist.
- After first deploy: smoke **`POST /api/demo/invoice-pdf`**; if fonts fail at runtime, add **`outputFileTracingIncludes`** for `packages/invoice-core/assets/fonts/**` (and related assets) in `next.config.ts`.

## What shipped earlier (Plan 3 + hardening)

- **Specs:** [`docs/specs/pdf-rendering.md`](docs/specs/pdf-rendering.md), [`docs/specs/spayd-qr.md`](docs/specs/spayd-qr.md), [`docs/specs/isdoc.md`](docs/specs/isdoc.md).
- **`@invoicey/invoice-core`**
  - `renderInvoicePdf`, `InvoicePdfDocument` — [`packages/invoice-core/src/pdf/`](packages/invoice-core/src/pdf/)
  - `buildSpaydPayload`, `renderSpaydQr` — [`packages/invoice-core/src/spayd/`](packages/invoice-core/src/spayd/)
  - `renderIsdoc`, `validateIsdocXml` — [`packages/invoice-core/src/isdoc/`](packages/invoice-core/src/isdoc/)
  - **Fonts:** vendored **Inter** (`Inter-Regular.ttf`, `Inter-Bold.ttf`, `LICENSE-inter.txt`) under [`packages/invoice-core/assets/fonts/`](packages/invoice-core/assets/fonts/); **Lora** TTFs + license also present (not necessarily registered in `register-fonts.ts` yet). [`register-fonts.ts`](packages/invoice-core/src/pdf/register-fonts.ts) resolves via `import.meta.url` + `cwd` fallbacks.
  - **ISDOC XSD:** [`packages/invoice-core/assets/schemas/isdoc-invoice-6.0.2.xsd`](packages/invoice-core/assets/schemas/isdoc-invoice-6.0.2.xsd); tests validate with **`xmllint-wasm`**.
- **Tests:** [`packages/invoice-core/src/plan03-render.test.ts`](packages/invoice-core/src/plan03-render.test.ts) — XSD validation, ISDOC snapshots, PDF `%PDF` smoke, SPAYD + QR fingerprint/snapshot.

## Web demo — keep for QA / tweaking

**Do not remove** this flow when improving PDF visuals; it is the fastest iteration surface.

| Piece | Purpose |
| --- | --- |
| Route **`/invoices/from-json`** | Paste/edit invoice JSON, preview PDF |
| **`apps/web/lib/demo-sample-invoice.json`** | Loadable realistic sample |
| **`POST /api/demo/invoice-pdf`** | Server builds PDF from posted JSON |
| Link from **`/invoices`** | Entry to the demo |

## Gotchas

1. **`@react-pdf/image`:** `<Image src={…}>` for fetched logos must use **`Buffer`**, not `Uint8Array` (Uint8Arrays are treated like URLs → bad fetches). See [`load-image.ts`](packages/invoice-core/src/pdf/load-image.ts).
2. **Tiny PNG logos:** images with IHDR **w,h ≤ 4** are skipped (avoids 1×1 “logo” blowing up to a black block).
3. **ISDOC root:** XSD requires **`version="6.0.2"`** on `<Invoice>`.
4. **SPAYD `AM`:** amount is in **koruny (major units)** — e.g. `1210` or `99.50` — **not** haléře. Implemented in [`build-spayd-payload.ts`](packages/invoice-core/src/spayd/build-spayd-payload.ts) via `formatSpaydAmCz`. After changing SPAYD: refresh golden expectations / QR snapshot — `cd packages/invoice-core && bun run test -- -u`.
5. **Golden refresh:** After intentional XML/PDF/QR output changes: `cd packages/invoice-core && bun run test -- -u`; XSD validation must stay green.

## Verification

```bash
bun install
bun run typecheck && bun run lint && bun run test && bun run build
```

## Next session — pick one track

**A — PDF shape / design**

1. Read [`docs/specs/pdf-rendering.md`](docs/specs/pdf-rendering.md) and [`packages/invoice-core/src/pdf/InvoicePdfDocument.tsx`](packages/invoice-core/src/pdf/InvoicePdfDocument.tsx).
2. Iterate with **`bun dev`** → **`/invoices/from-json`**; confirm QR amount matches invoice total in a banking app.
3. After layout stabilizes, resume **Plan 4** per [`docs/roadmap.md`](docs/roadmap.md).

**B — Plan 4 (ARES + clients)**  
Follow [`docs/roadmap.md`](docs/roadmap.md) Plan 4 exit criteria and architecture API routes under `apps/web/app/api`.

**C — Vercel**  
Add project settings or minimal `vercel.json`; verify preview build + PDF demo route + font tracing.

## Agent continuity

- **[`AGENTS.md`](AGENTS.md)** — workspace facts (`bun dev`, `.env.local` + `DATABASE_URL` when DB is wired, commit scopes).
- **Plan narratives:** [`.cursor/plans/`](.cursor/plans/) (Plans 01–03, etc.)

---

### Prompt for the next agent (paste to continue)

```text
Continue in repo `inveoiceyai`. Read HANDOVER.md and AGENTS.md first.

Goal (pick track A / B / C from HANDOVER):

- Prefer: iterate PDF visuals via /invoices/from-json + specs/pdf-rendering.md, OR start Plan 4 (ARES + clients) per docs/roadmap.md, OR finalize Vercel (Bun monorepo install/build + POST /api/demo/invoice-pdf smoke + font tracing if needed).

Constraints: Bun + Turbo; scopes in commitlint.config.mjs; do not mutate .cursor attached plans in-place for execution.

Verify with: bun run typecheck && bun run lint && bun run test && bun run build (and commit with conventional scopes when applicable).
```
