# PDF rendering specification

## Goal

Produce Czech-language invoice PDFs from a validated [`Invoice`](../../packages/invoice-core/src/schema.ts): readable layout with optional logo/stamp/signature, line table, VAT recap (when applicable), payment block, and embedded SPAYD QR. Single template; no template editor in MVP.

## Inputs / outputs

| Name | Type | Notes |
| --- | --- | --- |
| `renderInvoicePdf(invoice)` | `Promise<Uint8Array>` | Visual PDF + embedded `invoice.isdoc`. Assumes `InvoiceSchema` already satisfied. |
| `renderVisualInvoicePdf(invoice)` | `Promise<Uint8Array>` | Visual page only (no ISDOC attachment). |
| `embedIsdocInPdf(pdf, xml)` | `Promise<Uint8Array>` | `pdf-lib` attach helper used by `renderInvoicePdf`. |

## Stack

- **`@react-pdf/renderer`** (see ADR [0004](../decisions/0004-pdf-react-pdf-renderer.md))
- Embedded QR PNG as `<Image>` from `renderSpaydQr` (`data:image/png;base64,...`) per [spayd-qr](./spayd-qr.md)
- Logo / stamp / signature: remote URLs from snapshot (`issuer.logoUrl`, `stampUrl`, `signatureUrl`); fetched at render time → **`Buffer`** for `<Image src={buffer} />` — `@react-pdf/image` treats `Uint8Array` incorrectly (routes like URL fetch); use Node `Buffer` for binary images.

## Typography (Czech diacritics)

- **Family:** Inter (SIL OFL; Latin + Czech coverage).
- **Pin:** **vendored TTF copies** under `packages/invoice-core/assets/fonts/` — `Inter-Regular.ttf`, `Inter-Bold.ttf`, `Inter-Italic.ttf` (**`LICENSE-inter.txt`** bundled alongside). Fonts are repo contents, **not** read from npm at runtime (`node_modules`/Bun `.bun` layouts are unreliable inside Next/route handlers).
- **Rationale:** TTF avoids fontkit/layout issues observed with bundled WOFF from some font NPM packages under `@react-pdf/renderer`. Italic faces enable basic markdown italic in payment instruction free-text.
- **Registration:** Resolve absolute filesystem paths to those vendored files (module-relative `import.meta.url` + fallbacks); then `Font.register({ family: 'Inter', fonts: [...] })` once per process before `pdf()`.

## Layout (A4, default margins)

1. **Header row:** issuer block (name, address, IČO, DIČ if `issuer.vatPayer` and `issuer.dic`, `registryNote` if set) + optional **logo** (max height ~48pt, preserve aspect).
2. **Title band:** document label from `meta.docType` (Faktura / Proforma / Zálohová faktura / Dobropis), **`meta.number`**, issue date, due date, DUZP (see rules below).
3. **Client block:** `client.name`, address, IČO/DIČ if present, `contactEmail` optional.
4. **Items table:** columns — popis, množství, jed., cena bez DPH, DPH %, DPH, částka (nebo zjednodušený sloupcový rozvrh bez DPH pro neplátce). Sort by `items[].position`.
5. **Totals:** řádek „Celkem bez DPH“, „DPH celkem“ (hidden or „—„ when irrelevant), „Celkem k úhradě“ = `totals.total`. Currency `Kč`, format with Czech spacing (narrow no-break space as thousands sep where feasible).
6. **VAT recap:** „Rekapitulace DPH“ — one row per `totals.vatBreakdown[]` **only if** issuer is VAT payer **and** `vat.mode === 'regular'` **and** not effectively zero-rated-only display edge case; if `issuer.vatPayer === false`, show prose **„Nejsem plátce DPH.“** instead of recap table.
7. **`vat.mode === 'reverse_charge'`:** omit standard recap row table; print `vat.legalNote` prominently.
8. **`vat.mode === 'oss'`:** print recap by rate as for regular VAT where amounts exist; prepend/append OSS explanation line (Česky); destination context from `client.address.country` (`TODO(plan-later): explicit per-line OSS country once schema grows).
9. **Payment block:** for `payment.method === 'transfer'`, show domestic account (`bankAccount.accountNumber`), IBAN, BIC optional, VS/KS/SS if present. For cash/card show method label only (no QR — see SPAYD spec). Optional `payment.instructionsBefore` / `payment.instructionsAfter` render as multi-line text (basic markdown: bold/italic) immediately above / below this block.
10. **QR:** payment block adjacent or below — raster from `renderSpaydQr` (`width`/`height` per SPAYD spec).
11. **Stamp / signature:** if `issuer.stampUrl` and `customization.showStamp`, render stamp (e.g. lower-left). If `issuer.signatureUrl` and `customization.showSignature`, render signature strip. Respect `accentColor` as subtle stripe or heading tint (mapping table minimal: neutral=blue-gray, blue=accent blue, …).
12. **`notes`:** footer section „Poznámka“.
13. **Brand footer:** fixed page footer „Vystaveno přes Invoicey“ links to `https://ditrich.me/`.

## DUZP and non-tax documents

- **`invoice` / `credit_note`:** always show DUZP = `meta.duzp`.
- **`proforma` / `advance`:** schema still carries `meta.duzp` (often same as issue date); PDF **may omit** DUZP line or label it „DUZP (informativní)“ — Invoicey MVP: **omit** DUZP line for `proforma` and `advance` to reduce confusion (non-daňové / special-doc flows clarified in accountant training). ISDOC carries tax dates per [isdoc](./isdoc.md).

## Assets: SVG logos

MVP renderer supports **PNG and JPEG** from URLs reliably. **SVG:** optional post-MVP; if hit, log-friendly skip or omit image (ADR [0010](../decisions/0010-uploadthing-for-files.md) allows future `sharp` rasterization).

## ISDOC attachment

`renderInvoicePdf` renders the page with `@react-pdf/renderer`, then `pdf-lib` `attach()` embeds `invoice.isdoc` (`application/xml`). Download names should end with `-isdoc.pdf`. Standalone `renderIsdoc` remains available for raw XML.

## Issued artifact persistence

At **issue** time (and lazily on first download if missing), Invoicey uploads the canonical PDF + standalone ISDOC to UploadThing (`UTApi`) and stores `invoices.pdf_url` / `isdoc_url` / `pdf_generated_at`.

- **Drafts / live preview:** still generate on demand (`/api/demo/invoice-pdf`); not persisted.
- **Issued downloads** (`/api/invoices/[id]/pdf`, `/isdoc`): prefer stored URLs (proxied with immutable cache); if missing or `UPLOADTHING_TOKEN` unset, regenerate (and backfill when token is available).
- Helpers: `@invoicey/invoice-tools/artifacts` (`ensureInvoiceArtifacts` / `tryPersistInvoiceArtifacts`).

## Determinism & golden PDF tests

- Pin `@react-pdf/renderer` via lockfile; avoid non-pinned `@latest`.
- Omit dynamic “generated at” timestamps in template.
- If cross-OS PDF bytes still differ, tests allow **canonical fixture** stability on the **development reference OS** plus CI same runner; alternatively compare extracted text snapshots. Prefer **exact byte golden** when achievable after pinning font files and deps.

## References

- [domain/invoice-schema.md](../domain/invoice-schema.md), [vat-czech.md](../domain/vat-czech.md)
- [0004-pdf-react-pdf-renderer.md](../decisions/0004-pdf-react-pdf-renderer.md)

## Open questions

- **Resolved (Plan 3):** `advance` vs `proforma`: PDF wording differs (`Zálohová faktura` vs `Proforma faktura`); ISDOC `DocumentType` 4 vs 5 per [isdoc](./isdoc.md).
