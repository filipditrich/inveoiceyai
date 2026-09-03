# Performance audit — 2026-09-03

Scope: `apps/web` end to end — server render cost, database access, client
bundle, and interaction smoothness. Measured against `main` at `9e25b4f` with a
Turbopack production build and the live Neon database.

Everything under **Fixed** is implemented in this pass and verified. Everything
under **Open** is measured but deliberately not changed, with the reason.

---

## Method

- `next build --turbopack`, then `next start`, then fetching each public route
  and summing the JS its HTML actually references (raw and gzip). This measures
  what a browser downloads, not what a manifest claims.
- Per-route client payloads derived from
  `.next/server/app/**/page_client-reference-manifest.js`.
- Database work measured against the real database, including a workspace with
  117 invoices.
- Every rewritten query was checked against the implementation it replaced with
  a differential script: both run over all five workspaces that hold invoices,
  and their outputs are compared as JSON. `ALL MATCH` was the gate for keeping a
  rewrite.

---

## Headline numbers

| Surface                                     | Before                      | After               |
| ------------------------------------------- | --------------------------- | ------------------- |
| `/` marketing homepage, JS downloaded       | 1460 KB / 438 KB gz         | 1272 KB / 377 KB gz |
| Invoice status tally, 117-invoice workspace | 72 ms, 342 KB from Postgres | 15 ms, 6 rows       |
| Dashboard metrics, 117-invoice workspace    | 158 ms                      | 34 ms               |
| `loadIssuerOptions` round trips (5 issuers) | 22 sequential               | 2 parallel          |
| `(gated)` layout welcome-gate round trips   | 2                           | 1                   |

---

## Fixed

### 1. Two pages read the entire invoice table on every view

`/invoices` and `/dashboard` both ran `db.select().from(invoices)` with no
projection and no limit, then tallied statuses in JavaScript. The `invoices` row
carries three JSONB columns (`payload_json`, `issuer_snapshot`,
`client_snapshot`), so this moved the workspace's whole invoice corpus over the
wire on every page view — and grew linearly with the workspace forever.

At 117 invoices that was **342 KB and 72 ms per page view**. At 1,000 invoices
it would be roughly 2.9 MB.

Replaced with one grouped query in `lib/invoices/status-summary.ts`:
`resolveDisplayStatus` expressed as a SQL `CASE`, grouped by status and
currency. Six rows come back instead of the table. Both pages share it.

Two things worth knowing if you touch that query:

- The outstanding-amount `CASE` tests `cancelled_at`/`issued_at`/`paid_at`
  directly rather than reusing the status expression. Postgres will not match an
  expression nested inside `sum()` against a GROUP BY key.
- It groups by output position (`group by 1, 2`). Drizzle renders each `sql`
  fragment with fresh bind parameters per use, so repeating `${todayIso}` in
  both the select list and the GROUP BY produces `$1` and `$4` — different
  expressions as far as Postgres is concerned, and the query is rejected.

Both of these were found by running the query, not by reading it.

### 2. The dashboard sorted and bucketed 12 months of data in JS

`loadDashboardMetrics` used that same full read for the status cards, the
12-month chart, the currency balances, and the "recent invoices" list — the last
of which sorted every invoice in the workspace to take ten.

Now four bounded queries: grouped monthly issued totals, grouped monthly
allocations, a 12-month volume roll-up, and `ORDER BY updated_at DESC LIMIT 10`.
Output is byte-identical to the old implementation across every workspace and
both the filtered and unfiltered variants.

`packages/db/sql/2026-09-03-perf-indexes.sql` adds
`invoices_workspace_updated_idx` so that last query is an ordered index scan.
**It has not been applied** — see [Operator actions](#operator-actions).

### 3. Every list page did a write-amplifying backfill first

`loadIssuerOptions` — called by the dashboard, the invoice list, the client
list, the issuer list, and every invoice form — called
`ensureAllIssuerNumberingSchemes`, which looped issuers × four document types
issuing one `SELECT` each, sequentially, before the page could render. Five
issuers meant **20 serialised round trips** on a remote database, on every page
view, to discover that nothing was missing.

Now: the schemes are read once alongside the issuers (in parallel), the missing
set is computed in memory, and a single batched `INSERT … ON CONFLICT DO
NOTHING` runs only when something is actually absent. Steady state is two
parallel queries and zero writes.

### 4. The issuer-welcome gate cost two queries on every gated page

`shouldGateIssuerWelcome` runs in the `(gated)` layout, so every dashboard,
invoice, and client view paid for it — and for any established workspace the
answer is always "no". Collapsed to a single query with an `EXISTS` subselect.

### 5. The invoice detail page serialised thirteen awaits

`/invoices/[id]` awaited params, searchParams, three translation namespaces, the
locale, the session, the invoice, the Drive device count, the issuer, the email
messages, the email events, the suppression list, and the payment allocations —
each one after the last. Restructured into three waves: everything
session/locale-shaped in parallel, then the invoice, then everything that only
needs the invoice row in parallel. Same data, roughly a third of the latency.

### 6. A dev-only button put Zod on every page

`app/providers.tsx` imported the `@/features/c15t` barrel, which re-exports
`C15tDevControls`, which imported `@/env.config.client` for an `IS_LOCAL_DEV`
check. That module validates with Zod, so a local-QA reset button pulled Zod's
entire error-message table into the client bundle of every page, marketing
included. Both dev-only components now read `process.env.NODE_ENV` directly.

This removed the 139 KB c15t/uploadthing chunk from the homepage. It did **not**
remove Zod itself — see the open finding below.

### 7. Zod in the invoice list for an enum

`invoice-list-table.tsx` and `invoice-list-filters.tsx` imported
`InvoiceOriginProviderSchema` to enumerate nine strings and check membership.
`@invoicey/invoice-core/import` now exports `INVOICE_ORIGIN_PROVIDERS` (a plain
tuple) and `isInvoiceOriginProvider`, with the Zod enum derived from the tuple,
so the highest-traffic app page no longer pulls a schema validator to render a
label.

### 8. `public/` was served with `max-age=0`

Next serves `public/` with no caching by default. `public/brand/models/`
`invoicey.glb` is **3.87 MB** and is revalidated on every landing that reaches
the 3D mascot. Added a one-day `Cache-Control` with a 30-day
`stale-while-revalidate` for `/brand/*` and `/banks/*`.

---

## Open

### Zod ships on every page anyway — 277 KB raw / 63 KB gz

After the fixes above, no module reachable from the marketing page imports Zod.
I verified this three ways: a transitive import trace from every client entry
point on that page, a search of every client-side dependency for a `zod` import,
and a check of which chunks reference Zod's module id — all five of its importers
live on app routes that the marketing page never loads.

Turbopack still emits the Zod chunk in the homepage's script list, because Zod is
common across enough routes that it lands in a shared chunk the root layout's
client group references. It is the **second largest chunk on the landing page,
after `react-dom`**.

Two contributing facts worth recording:

- The chunk carries Zod v4's full locale table — roughly 55 translated error
  message sets. Adding `experimental.optimizePackageImports: ["zod"]` did not
  help (measured: 372 → 384 KB gz, slightly worse), so it was reverted.
- The monorepo installs **four** Zod copies: `apps/web`, `@invoicey/db`, and
  `@invoicey/env` on 4.4.2; `@invoicey/invoice-core` and
  `@invoicey/invoice-tools` declare `^3.24.4` and resolve to 3.25.76. Since
  `invoice-core/schema` is imported across the UI, aligning it to 4.4.2 removes a
  whole duplicate library from any bundle that pulls both.

The remaining client-side Zod importers are few and each is addressable:
`invoice-builder-form.tsx`, `lib/invoice-draft-recovery.ts`,
`lib/app-build-info.ts` (via `BuildMark`), `look-document-editor.tsx`,
`invoices/from-json/page.tsx`, `invoice-import-form.tsx`,
`account-gender-select.tsx`, and `issuer-form-shared.tsx`. Most validate a
payload that a server action could validate instead. Emptying that list is what
would let the bundler drop Zod from the shared chunk — worth doing, but it is a
set of behaviour changes rather than a mechanical fix, so it is not in this pass.

### Every list row is rendered twice

`components/data-grid/app-data-grid.tsx` renders `DataGridMobileCards`
(`md:hidden`) and `DataGridTable` (`hidden md:block`) side by side, both always
mounted. At the 100-row page size that is ~2,400 cells in the DOM instead of
~1,200, and React reconciles both trees on every sort, filter, and selection
change — on desktop, half that work paints nothing.

This is a deliberate SSR-correct design (the server cannot know the viewport), so
the fix is a judgement call, not a cleanup: gate one branch behind a
`useMediaQuery` and accept a hydration-time swap, or keep both and cap the
mobile card list. Left as-is.

### Every route is dynamic, including the legal pages

The build marks all 96 routes `ƒ (Dynamic)` — `/`, `/privacy`, `/terms`,
`/cookies`, `/brand`, `/security/trust`, and `/docs/[[...slug]]` included. The
root layout awaits `getLocale()`, which reads the `NEXT_LOCALE` cookie, so
nothing can prerender. The marketing homepage additionally awaits
`getOptionalSession()` at the top level, which adds a session lookup before the
first byte.

Making the landing page mostly static — with the signed-in chip in a
Suspense-wrapped dynamic slot — is the largest remaining TTFB win on the
public site, but it interacts with the cookie-based locale strategy and is a
design decision.

### No streaming below the top-level segments

There are five `loading.tsx` files and no `Suspense` boundaries inside pages.
The dashboard and invoice list now resolve fast enough that this matters less
than it did, but the invoice detail page still blocks its whole render on the
email timeline and payment ledger — both good candidates for a streamed slot.

### Nothing is code-split

There is not a single `next/dynamic` or `React.lazy` in the app. The 3D scene
and Mermaid are lazily `import()`ed by hand, which is why they are not a
problem. Heavy, rarely-first-paint components — `invoice-builder-form.tsx` (2,219
lines), `look-document-editor.tsx`, the Recharts dashboard charts — are all in
the static graph of their routes.

### Unused large assets in `public/`

`public/brand/invoicey-app-icon-dark.png` (264 KB) and
`invoicey-app-icon-light.png` (245 KB) are referenced nowhere in the repo — only
the `.svg` of the same name is used. 509 KB of dead weight in the deployment.
Not deleted here: they may exist for the brand kit on purpose.

### The 3.87 MB mascot

`invoicey.glb` is uncompressed. It is loaded well — desktop only, fine pointer
only, not under `prefers-reduced-motion`, behind an `IntersectionObserver` — but
Draco or meshopt compression typically takes a model like this to a few hundred
kilobytes.

---

## Operator actions

1. Apply `packages/db/sql/2026-09-03-perf-indexes.sql`. It uses `CREATE INDEX
CONCURRENTLY`, so run it outside a transaction block. The dashboard is
   correct without it; it will just sort instead of scanning an index.
2. Nothing else. No environment variables changed and no behaviour is gated on
   the index existing.

## Verification

- `bun run gates` (typecheck + lint + format) exits 0; no new warnings in the
  changed files.
- `bun run test`: 244 passed, 2 failed. Both failures are in
  `agent/lib/slack-interactions.test.ts` and reproduce identically on unmodified
  `main` — they predate this work and are unrelated to it.
- `next build --turbopack` succeeds.
- Every rewritten query verified against its predecessor on the live database
  across all five workspaces holding invoices: `ALL MATCH`.
