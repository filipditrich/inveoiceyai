# 0004: PDF rendering via @react-pdf/renderer

## Status

Accepted (Phase 0, 2026-05-03)

## Context

Every invoice needs a PDF rendering. The options:

1. **`@react-pdf/renderer`** — describe PDFs in JSX (`<Document>`, `<Page>`, `<View>`, `<Text>`, …); pure JS; runs in serverless functions; no headless browser dependency.
2. **HTML + Puppeteer / Playwright (chromium-min)** — render HTML through a real browser. Full CSS and web-platform features, but Chromium needs to ship into Vercel functions (50–80 MB cold start).
3. **HTML + Paged.js (server-side)** — runs paged.js inside Node; flaky for complex layouts; less mature.
4. **PDFKit / pdf-lib** — lower-level PDF construction; no JSX; tedious for design-heavy documents.
5. **Server-side rendering of HTML to PDF via a third-party API (Browserless, etc.)** — adds an external dependency for a feature that should be 100 % local.

Forces:

- Invoices are layout-stable: a header, a parties block, an items table, a totals block, a payment block, a QR code, optional stamp/signature, footer. Everything we need is reproducible in `@react-pdf/renderer`.
- Performance matters — generating PDFs at edge / Function speed without 50 MB cold starts
- Czech-diacritic support requires custom font registration; both `@react-pdf/renderer` and Puppeteer support this
- We do not need pixel-perfect HTML-to-PDF parity (we're not reproducing a designed web page; we're rendering structured data)
- The MVP has *one* template — not a template editor — so feature parity with HTML is not critical

## Decision

`renderInvoicePdf(invoice): Promise<Uint8Array>` is implemented in `@invoicey/invoice-core` using **`@react-pdf/renderer`**.

The implementation:

- Lives in `packages/invoice-core/src/pdf/`
- Embeds a Czech-diacritic-supporting font (Inter / Roboto / IBM Plex Sans — final choice in Plan 3)
- Embeds the SPAYD QR as an `<Image>` with a base64 data URL produced by `qrcode`
- Imports issuer logo / stamp / signature from URLs (UploadThing) via `<Image src={url} />`
- Renders to `Uint8Array` for streaming via the route handler

## Consequences

### Positive

- Zero-dependency on Chromium → small bundle, fast cold starts, no Vercel function-size pressure
- Pure-JS pipeline — same code path runs in tests, in dev, in prod
- Layout is described declaratively in JSX; reviewable in PRs
- Component tree is testable (golden-file fixtures with byte-stable PDFs by pinning timestamps)

### Negative

- CSS subset is limited — no flexbox grid, no CSS variables, no advanced text-shaping. The invoice layout is simple enough; it's a real constraint we accept.
- Right-to-left, complex scripts, OpenType ligatures are weaker than browser rendering. Czech doesn't need any of this.
- Some advanced PDF features (form fields, embedded files) are absent. Not needed for MVP.

### Neutral

- Switching later (e.g. to Puppeteer for a "custom-template editor" post-MVP) would require rewriting the renderer module; the public API `renderInvoicePdf(invoice)` would not change
- Font licensing: Inter / Roboto / IBM Plex Sans are all OFL/Apache-2.0/IPA — none impose redistribution issues for embedding into a PDF served by our app

## Plans touched

- Plan 3 (PDF / QR / ISDOC) — primary implementation
- Plan 6 (invoice builder) — live preview consumes the same renderer

## References

- [react-pdf docs](https://react-pdf.org/)
- Considered alternatives discussed inline above
