# PDF rendering specification

## Goal

Produce Czech-language invoice PDFs from a validated [`Invoice`](../../packages/invoice-core/src/schema.ts): readable layout with optional logo/stamp/signature, line table, VAT recap (when applicable), payment block, and embedded SPAYD QR. Single template; no template editor in MVP.

## Inputs / outputs

| Name | Type | Notes |
| --- | --- | --- |
| `renderInvoicePdf(invoice)` | `Promise<Uint8Array>` | Assumes `InvoiceSchema` already satisfied; no re-parse in hot path (optional `parse` in tests only). |

## Stack

- **`@react-pdf/renderer`** (see ADR [0004](../decisions/0004-pdf-react-pdf-renderer.md))
- Embedded QR PNG as `<Image>` from `renderSpaydQr` (`data:image/png;base64,...`) per [spayd-qr](./spayd-qr.md)
- Logo / stamp / signature: remote URLs from snapshot (`issuer.logoUrl`, `stampUrl`, `signatureUrl`); fetched at render time → **`Buffer`** for `<Image src={buffer} />` — `@react-pdf/image` treats `Uint8Array` incorrectly (routes like URL fetch); use Node `Buffer` for binary images.

## Typography (Czech diacritics)

- **Family:** DejaVu Sans (Bitstream Vera derivative; permissive license; Latin + Czech coverage).
- **Pin:** npm package **`dejavu-fonts-ttf`** at a **fixed version** (`2.x` published on npm; repo lockfile is source of truth). Code resolves `DejaVuSans.ttf` / `DejaVuSans-Bold.ttf` via `require.resolve` from `dejavu-fonts-ttf/ttf/…`.
- **Rationale:** TTF avoids fontkit/layout issues observed with bundled WOFF from some font NPM packages under `@react-pdf/renderer`.
- **Registration:** `Font.register({ family: 'DejaVu Sans', fonts: [{ src: regularPath, fontWeight: 400 }, { src: boldPath, fontWeight: 700 }] })` once per process (module init), before `pdf()`.

## Layout (A4, default margins)

1. **Header row:** issuer block (name, address, IČO, DIČ if `issuer.vatPayer` and `issuer.dic`, `registryNote` if set) + optional **logo** (max height ~48pt, preserve aspect).
2. **Title band:** document label from `meta.docType` (Faktura / Proforma / Zálohová faktura / Dobropis), **`meta.number`**, issue date, due date, DUZP (see rules below).
3. **Client block:** `client.name`, address, IČO/DIČ if present, `contactEmail` optional.
4. **Items table:** columns — popis, množství, jed., cena bez DPH, DPH %, DPH, částka (nebo zjednodušený sloupcový rozvrh bez DPH pro neplátce). Sort by `items[].position`.
5. **Totals:** řádek „Celkem bez DPH“, „DPH celkem“ (hidden or „—„ when irrelevant), „Celkem k úhradě“ = `totals.total`. Currency `Kč`, format with Czech spacing (narrow no-break space as thousands sep where feasible).
6. **VAT recap:** „Rekapitulace DPH“ — one row per `totals.vatBreakdown[]` **only if** issuer is VAT payer **and** `vat.mode === 'regular'` **and** not effectively zero-rated-only display edge case; if `issuer.vatPayer === false`, show prose **„Nejsem plátce DPH.“** instead of recap table.
7. **`vat.mode === 'reverse_charge'`:** omit standard recap row table; print `vat.legalNote` prominently.
8. **`vat.mode === 'oss'`:** print recap by rate as for regular VAT where amounts exist; prepend/append OSS explanation line (Česky); destination context from `client.address.country` (`TODO(plan-later): explicit per-line OSS country once schema grows).
9. **Payment block:** for `payment.method === 'transfer'`, show domestic account (`bankAccount.accountNumber`), IBAN, BIC optional, VS/KS/SS if present. For cash/card show method label only (no QR — see SPAYD spec).
10. **QR:** payment block adjacent or below — raster from `renderSpaydQr` (`width`/`height` per SPAYD spec).
11. **Stamp / signature:** if `issuer.stampUrl` and `customization.showStamp`, render stamp (e.g. lower-left). If `issuer.signatureUrl` and `customization.showSignature`, render signature strip. Respect `accentColor` as subtle stripe or heading tint (mapping table minimal: neutral=blue-gray, blue=accent blue, …).
12. **`notes`:** footer section „Poznámka“.

## DUZP and non-tax documents

- **`invoice` / `credit_note`:** always show DUZP = `meta.duzp`.
- **`proforma` / `advance`:** schema still carries `meta.duzp` (often same as issue date); PDF **may omit** DUZP line or label it „DUZP (informativní)“ — Invoicey MVP: **omit** DUZP line for `proforma` and `advance` to reduce confusion (non-daňové / special-doc flows clarified in accountant training). ISDOC carries tax dates per [isdoc](./isdoc.md).

## Assets: SVG logos

MVP renderer supports **PNG and JPEG** from URLs reliably. **SVG:** optional post-MVP; if hit, log-friendly skip or omit image (ADR [0010](../decisions/0010-uploadthing-for-files.md) allows future `sharp` rasterization).

## Determinism & golden PDF tests

- Pin `@react-pdf/renderer` via lockfile; avoid non-pinned `@latest`.
- Omit dynamic “generated at” timestamps in template.
- If cross-OS PDF bytes still differ, tests allow **canonical fixture** stability on the **development reference OS** plus CI same runner; alternatively compare extracted text snapshots. Prefer **exact byte golden** when achievable after pinning font files and deps.

## References

- [domain/invoice-schema.md](../domain/invoice-schema.md), [vat-czech.md](../domain/vat-czech.md)
- [0004-pdf-react-pdf-renderer.md](../decisions/0004-pdf-react-pdf-renderer.md)

## Open questions

- **Resolved (Plan 3):** `advance` vs `proforma`: PDF wording differs (`Zálohová faktura` vs `Proforma faktura`); ISDOC `DocumentType` 4 vs 5 per [isdoc](./isdoc.md).
