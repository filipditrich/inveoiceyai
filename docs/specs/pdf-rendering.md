# PDF rendering specification

## Goal

Produce invoice PDFs from a validated [`Invoice`](../../packages/invoice-core/src/schema.ts): readable layout with optional logo/stamp/signature, line table, VAT recap (when applicable), payment block, and embedded SPAYD QR. Labels and `Intl` formatting follow `meta.language` (`cs` | `en`, [ADR 0028](../decisions/0028-per-invoice-language.md)). Layout is a **look document** interpreted by `@react-pdf/renderer` ([pdf-looks](./pdf-looks.md), [ADR 0039](../decisions/0039-looks-are-data-react-pdf-interprets.md)): Classic `1.0.0` is today’s face as data; Minimal `1.0.0` is a second layout. There is no HTML editor.

## Inputs / outputs

| Name                              | Type                  | Notes                                                                             |
| --------------------------------- | --------------------- | --------------------------------------------------------------------------------- |
| `renderInvoicePdf(invoice)`       | `Promise<Uint8Array>` | Visual PDF + embedded `invoice.isdoc`. Assumes `InvoiceSchema` already satisfied. |
| `renderVisualInvoicePdf(invoice)` | `Promise<Uint8Array>` | Visual page only (no ISDOC attachment).                                           |
| `embedIsdocInPdf(pdf, xml)`       | `Promise<Uint8Array>` | `pdf-lib` attach helper used by `renderInvoicePdf`.                               |

## Stack

- **`@react-pdf/renderer`** (see ADR [0004](../decisions/0004-pdf-react-pdf-renderer.md))
- Embedded QR PNG as `<Image>` from `renderSpaydQr` (`data:image/png;base64,...`) per [spayd-qr](./spayd-qr.md)
- Logo / stamp / signature: remote URLs from snapshot (`issuer.logoUrl`, `stampUrl`, `signatureUrl`); fetched at render time → **`Buffer`** for `<Image src={buffer} />` — `@react-pdf/image` treats `Uint8Array` incorrectly (routes like URL fetch); use Node `Buffer` for binary images.

## Typography (Czech diacritics)

- **Family:** Inter (SIL OFL; Latin + Czech coverage).
- **Pin:** **vendored TTF copies** under `packages/invoice-core/assets/fonts/` — `Inter-Regular.ttf`, `Inter-Bold.ttf`, `Inter-Italic.ttf` (**`LICENSE-inter.txt`** bundled alongside). Fonts are repo contents, **not** read from npm at runtime (`node_modules`/Bun `.bun` layouts are unreliable inside Next/route handlers).
- **Rationale:** TTF avoids fontkit/layout issues observed with bundled WOFF from some font NPM packages under `@react-pdf/renderer`. Italic faces enable basic markdown italic in payment instruction free-text.
- **Registration:** Resolve absolute filesystem paths to those vendored files (module-relative `import.meta.url` + fallbacks); then `Font.register({ family: 'Inter', fonts: [...] })` once per process before `pdf()`.

## Layout (A4)

Band order comes from the resolved look ([pdf-looks](./pdf-looks.md)). The list below is what each block prints, not a fixed page order. Classic `1.0.0` still uses this content.

1. **Header row:** issuer block (name, address, IČO, DIČ if `issuer.vatPayer` and `issuer.dic`, `registryNote` if set) + optional **logo** (max height ~48pt, preserve aspect).
2. **Title band:** document label from `meta.docType` (Faktura / Proforma / Zálohová faktura / Dobropis), **`č.` / `No.`**, **`meta.number`** (e.g. `Faktura č. 20260119`). For a VAT-payer `invoice`, a micro-line **DAŇOVÝ DOKLAD** / **TAX DOCUMENT**. **Omit that line when `issuer.vatPayer === false`** — a non-payer invoice is not a tax document. Issue date, due date, and performance date follow in the customer column (see DUZP rules below).
3. **Client block:** `client.name`, address, IČO/DIČ if present, `contactEmail` optional. Postal line is `PSČ město` with no comma (`110 00 Praha`).
4. **Items table:** columns — popis, množství (qty + unit in one column), jedn. cena, DPH % (VAT-payer only), celkem. Sort by `items[].position`.
5. **Totals:** řádek „Celkem bez DPH“, „DPH celkem“ (hidden or „—„ when irrelevant), „Celkem k úhradě“ = `totals.total`. Amounts use a no-break space plus a language-aware suffix: Czech CZK → `Kč`, English CZK → `CZK`, EUR/USD → ISO code. Number grouping follows `meta.language`.
6. **VAT recap:** „Rekapitulace DPH“ — one row per `totals.vatBreakdown[]` **only if** issuer is VAT payer **and** `vat.mode === 'regular'` **and** not effectively zero-rated-only display edge case; if `issuer.vatPayer === false`, show prose **„Nejsem plátce DPH.“** instead of recap table.
7. **`vat.mode === 'reverse_charge'`:** omit standard recap row table; print `vat.legalNote` prominently.
8. **`vat.mode === 'oss'`:** print recap by rate as for regular VAT where amounts exist; prepend/append OSS explanation line (Česky); destination context from `client.address.country` (`TODO(plan-later): explicit per-line OSS country once schema grows).
9. **Payment block:** for `payment.method === 'transfer'`, show domestic account (`bankAccount.accountNumber`), IBAN, BIC optional, VS/KS/SS if present. For cash/card show method label only (no QR — see SPAYD spec). Optional `payment.instructionsBefore` / `payment.instructionsAfter` render as multi-line text (basic markdown: bold/italic) immediately above / below this block.
10. **QR:** payment block adjacent or below — raster from `renderSpaydQr` (`width`/`height` per SPAYD spec).
<<<<<<< HEAD
11. **Stamp / signature:** if `issuer.stampUrl` and `customization.showStamp`, render stamp at **176×176 pt**. If `issuer.signatureUrl` and `customization.showSignature`, render signature strip. Respect `accentColor` as subtle stripe or heading tint (mapping table minimal: neutral=blue-gray, blue=accent blue, …).
=======
11. **Stamp / signature:** theme flags from the resolved look (`showStamp` / `showSignature`), not `customization`. Accent comes from the look theme (and `appearance` overlay).
>>>>>>> 50a4cfe (feat: ship Classic and Minimal as versioned invoice looks)
12. **`notes`:** footer section „Poznámka“.
13. **Brand footer:** fixed page footer „Vystaveno přes Invoicey“ links to `https://invoicey.ditrich.me/`.

## DUZP and non-tax documents

- **`invoice` / `credit_note`:** always show `meta.duzp`. Label is **Datum zdan. plnění** / **Tax point date** when `issuer.vatPayer`; otherwise **Datum uskutečnění plnění** / **Date of supply** (keep the date, do not pretend there is a VAT taxable-supply date).
- **`proforma` / `advance`:** schema still carries `meta.duzp` (often same as issue date); PDF **may omit** DUZP line or label it „DUZP (informativní)“ — Invoicey MVP: **omit** DUZP line for `proforma` and `advance` to reduce confusion (non-daňové / special-doc flows clarified in accountant training). ISDOC carries tax dates per [isdoc](./isdoc.md).

## Assets: SVG logos

MVP renderer supports **PNG and JPEG** from URLs reliably. **SVG:** optional post-MVP; if hit, log-friendly skip or omit image (ADR [0010](../decisions/0010-uploadthing-for-files.md) allows future `sharp` rasterization).

## ISDOC attachment

`renderInvoicePdf` renders the page with `@react-pdf/renderer`, then `pdf-lib` `attach()` embeds `invoice.isdoc` (`application/xml`). Download names should end with `-isdoc.pdf`. Standalone `renderIsdoc` remains available for raw XML.

## Issued artifact persistence

At **issue** time (and lazily on first download if missing), Invoicey uploads the canonical PDF + standalone ISDOC to UploadThing (`UTApi`) and stores `invoices.pdf_url` / `isdoc_url` / `pdf_generated_at`.

- **Drafts / live preview:** still generate on demand (`/api/demo/invoice-pdf`); not persisted.
- **Issued downloads** (`/api/invoices/[id]/pdf`, `/isdoc`): prefer stored URLs (proxied with immutable cache); if missing or `UPLOADTHING_TOKEN` unset, regenerate (and backfill when token is available).
- **Imported invoices** (`artifacts_immutable` / `import_completeness`): never regenerate; always serve the stored original (see [`invoice-import.md`](./invoice-import.md), [ADR 0021](../decisions/0021-immutable-imported-invoice-artifacts.md)).
- Helpers: `@invoicey/invoice-tools/artifacts` (`ensureInvoiceArtifacts` / `tryPersistInvoiceArtifacts`).

## Determinism & golden PDF tests

- Pin `@react-pdf/renderer` via lockfile; avoid non-pinned `@latest`.
- Omit dynamic “generated at” timestamps in template.
- If cross-OS PDF bytes still differ, tests allow **canonical fixture** stability on the **development reference OS** plus CI same runner; alternatively compare extracted text snapshots. Prefer **exact byte golden** when achievable after pinning font files and deps.

## References

- [domain/invoice-schema.md](../domain/invoice-schema.md), [vat-czech.md](../domain/vat-czech.md)
- [pdf-looks.md](./pdf-looks.md)
- [0004-pdf-react-pdf-renderer.md](../decisions/0004-pdf-react-pdf-renderer.md)

## Open questions

- **Resolved (Plan 3):** `advance` vs `proforma`: PDF wording differs (`Zálohová faktura` vs `Proforma faktura`); ISDOC `DocumentType` 4 vs 5 per [isdoc](./isdoc.md).
