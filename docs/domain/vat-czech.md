# Czech VAT (DPH) — domain rules

How Invoicey models Czech VAT. This is one of the highest-risk domain areas: incorrect VAT on an invoice has tax-authority consequences. Anything ambiguous below should be resolved with reference to _zákon č. 235/2004 Sb. o dani z přidané hodnoty_ (the VAT Act) and a CPA — not by reading more docs.

Cross-references: [`invoice-schema.md`](./invoice-schema.md), [`../glossary.md`](../glossary.md).

## Rates supported (2026)

| Rate     | Czech name                                | Applies to (highlights)                                                                                                                                                                                                          |
| -------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **21 %** | základní sazba (standard)                 | Most goods and services: electronics, professional services (IT, consulting, legal), most food/beverages, fuel, electricity, gas, telecom                                                                                        |
| **12 %** | snížená sazba (reduced)                   | Selected items per Annexes 2 and 3 of the VAT Act: tap water, heat/cooling, accommodation, restaurant catering (food, _not_ alcohol), passenger transport, residential construction, repairs of housing, certain food categories |
| **0 %**  | nulová sazba / osvobození (zero / exempt) | Books and periodicals (incl. e-books), exports outside the EU, intra-EU supplies of goods to VAT-payers                                                                                                                          |

Rate history (for the legacy-VAT TODO):

| Period    | Standard | Reduced 1 | Reduced 2  |
| --------- | -------- | --------- | ---------- |
| 2024–2026 | 21 %     | 12 %      | — (merged) |
| 2015–2023 | 21 %     | 15 %      | 10 %       |
| 2013–2014 | 21 %     | 15 %      | —          |

Source: [Kurzy.cz DPH 2026](https://www.kurzy.cz/dph/) and [ainvoice 2026 přehled](https://ainvoice.cz/blog/sazby-dph-2026/).

### TODO(plan-2): historical rates 15 % / 10 %

For backdated invoices (e.g. a 2023 DUZP), legacy rates may be required. Default plan: allow any positive integer rate via `VatRateSchema` so 15 / 10 / 5 / etc. are entered as custom. The UI nudges you toward 21 / 12 / 0 but does not forbid others. Revisit if this turns out to be a footgun.

## UX presets vs canonical storage

Canonical stored invoices stay **exclusive**: `unitPriceWithoutVat` + top-level `vat` + per-line `vatRate`. The web builder and AI draft path add an intent layer that normalizes into that shape.

### Builder presets (`vatMode` as regime)

| UX preset                                | Effect                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| **Neplátce** (`issuer.vatPayer = false`) | Force `vat.mode = regular`, all line `vatRate = 0`, hide rate picker        |
| **Plátce – běžný**                       | `vat.mode = regular`, rate select **0 / 12 / 21** (+ optional custom)       |
| **Přenesení DPH**                        | `vat.mode = reverse_charge`, force all rates `0`, require code + client DIČ |
| **OSS**                                  | Unchanged; still behind an advanced checkbox                                |

New lines default to `vatRate = 21` when the issuer is a VAT-payer, otherwise `0`. Switching to reverse charge or to a non–VAT-payer issuer zeros rates (and forces regular for neplátce).

### Price entry toggle (`pricesIncludeVat`)

Invoice-level **“Ceny bez DPH” / “Ceny s DPH”**. When inclusive, each line converts before `calcTotals` / persist:

```
exclusive = round2(inclusive / (1 + rate/100))
```

For reverse charge / neplátce the conversion rate is `0` (amount unchanged aside from rounding). Live totals always use effective rates so RC + a leftover UI rate cannot blank the totals strip.

### AI / MCP draft helpers

Drafts may send high-level fields (stripped before schema validate):

- `vatPreset`: `neplatce` | `regular` | `reverse_charge` | `oss` — invents `{ mode, suppliesAbroad: "none" }` when `vat` is missing (`neplatce` → `regular`)
- `pricesIncludeVat: true` — converts inclusive unit prices to exclusive

Still fail closed on missing `vat`/`vatPreset`, and on reverse charge without `localReverseChargeCode`. Do **not** silently invent legal notes or RC codes. Non–VAT-payer issuers are coerced to `mode: regular` and line `vatRate: 0` before validate.

## Modes (`vat.mode` in the schema)

The Czech VAT Act recognizes several invoicing scenarios. Invoicey collapses them into three modes that drive PDF/ISDOC behavior:

### `regular`

Standard domestic invoice. Issuer charges VAT at the appropriate rate per line. Recipient deducts input VAT (if eligible).

- Used for: domestic B2B and B2C, domestic VAT-payer to domestic anything
- Required: `issuer.vatPayer = true` and at least some line(s) with `vatRate > 0`
- DUZP: required, typically equal to the date the service was rendered or the goods were delivered
- PDF: shows full VAT breakdown ("Rekapitulace DPH")
- ISDOC: standard `<TaxTotal>` blocks per rate

If `issuer.vatPayer = false`, this mode is still used but every line's `vatRate = 0` and the PDF says "Nejsem plátce DPH" instead of a VAT breakdown. ISDOC reflects the same.

### `reverse_charge` (přenesená daňová povinnost, RC, PDP)

The recipient — not the supplier — accounts for VAT. Mandated by §92 of the VAT Act for specific B2B scenarios:

- Construction services (most cases) — §92e
- Supplies of scrap metal, mobile phones, integrated circuits, gaming consoles, certain agricultural goods — §92c, §92d, §92f, …
- Most cross-border B2B services within the EU (place of supply rules — §9)

Effects:

- Issuer's invoice shows `vatRate = 0` on every line
- VAT total is 0
- A legal note appears on the PDF; we default to one of:
  - "Daň odvede zákazník dle § 92a zákona č. 235/2004 Sb." (general)
  - "Daň odvede zákazník dle § 92e zákona č. 235/2004 Sb." (construction, more specific)
  - "Reverse charge — VAT to be accounted for by the recipient." (English form, optional)
- Both issuer and client must be VAT payers (the schema requires `issuer.vatPayer && client.dic`)
- `vat.localReverseChargeCode` is **required** — ISDOC `LocalReverseChargeCode` from the PDP číselník (e.g. `4` = stavební/montážní práce). Do **not** put a §92x paragraph here
- DUZP is required as for regular
- ISDOC: line `ClassifiedTaxCategory/LocalReverseCharge` + tax total `LocalReverseChargeFlag`

### `oss` (One-Stop Shop)

EU-wide simplification for B2C cross-border supplies of goods/services/digital. The supplier:

- Charges the _destination country's_ VAT rate
- Reports it through a single OSS return in the home country
- Does not register for VAT in each destination country

Effects:

- `client` is in another EU country (`client.address.country !== 'CZ'` and `vat.suppliesAbroad = 'eu'`)
- `vatRate` per line is the destination country's rate, not Czech
- The PDF shows the destination rate explicitly and notes "Zdaněno dle pravidel OSS"
- Issuer must be enrolled in OSS (we don't model this — it's an issuer attribute that's currently captured implicitly by the issuer turning on this mode)

OSS is supported in the schema but not in the MVP UX; the builder hides this mode by default and surfaces it in an "advanced" toggle.

### TODO(plan-2): `oss` schema-level destination rate

`InvoiceItemSchema.vatRate` is currently a flat number. For OSS we need to track _which country's_ rate it is, which matters for ISDOC. Either (a) extend each item with `vatCountry`, or (b) attach `vatCountry` to the invoice-level `vat` block. Decision lands during Plan 2.

## Supplies abroad (`vat.suppliesAbroad`)

Independent flag from `vat.mode`. Used to drive PDF wording and ISDOC tagging:

| Value    | Meaning                           | Common combinations                                                           |
| -------- | --------------------------------- | ----------------------------------------------------------------------------- |
| `none`   | Domestic supply                   | `mode: regular`, `mode: reverse_charge` (domestic RC)                         |
| `eu`     | Supply to another EU member state | `mode: reverse_charge` (B2B EU services), `mode: oss` (B2C EU goods/services) |
| `non_eu` | Supply outside the EU             | `mode: regular` with `vatRate: 0` (export)                                    |

The PDF shows different boilerplate for each:

- `eu` + `reverse_charge` → "Reverse-charge: VAT to be accounted for by the recipient (Article 196 of Council Directive 2006/112/EC)."
- `non_eu` + `regular` (vatRate 0) → "Vývoz mimo EU — osvobozeno od DPH."

## DUZP — datum uskutečnění zdanitelného plnění

Date of taxable supply. Mandatory on every Czech invoice with VAT lines.

### Rules

- For services: typically the date the service was rendered (often = end of service period). For ongoing services, the last day of the period covered by the invoice
- For goods: typically the date of delivery / handover
- If an advance payment was received before the goods/services were supplied: DUZP = date of receiving the payment, capped to 15 days into the next month
- DUZP **may** precede `issueDate` (you bill in May for April work)
- DUZP **may** equal `issueDate` (most common)
- DUZP **rarely** follows `issueDate` (allowed in some advance scenarios — but unusual)

The schema enforces `duzp` is a valid ISO date but does not enforce a relation to `issueDate`. UI nudges you toward "DUZP = issueDate" with a single toggle.

### What goes in `duzp` for proforma / advance?

`proforma` and `advance` are not tax documents — they're payment requests. Czech practice:

- Some tools omit DUZP entirely on proforma → ISDOC accepts this
- Other tools set DUZP = issueDate as a placeholder

We default to `duzp = issueDate` for both `proforma` and `advance` because the schema requires DUZP non-optional. The PDF can choose to _not render_ DUZP for these doc types. ISDOC sets the doc type accordingly so importers handle it correctly.

### TODO(plan-2): DUZP visibility per doc type

Confirm during Plan 2 that PDF rendering hides DUZP for `proforma`/`advance` (or shows it labeled differently) and ISDOC does the right thing per the spec.

## Plátce vs neplátce — issuer-level switch

`issuer_businesses.vatPayer` is the canonical flag. Effects ripple through every invoice issued from that issuer:

| `issuer.vatPayer` | What happens                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `true`            | Invoice is a _daňový doklad_. VAT lines, breakdown, DIČ printed, ISDOC includes `<TaxTotal>`             |
| `false`           | Invoice is _not a tax document_. No DIČ rendered, every line `vatRate = 0`, PDF says "Nejsem plátce DPH" |

The UI prevents you from setting `vat.mode != 'regular'` if `vatPayer = false`.

## Worked examples

### Example 1 — Domestic IT services from a VAT-payer s.r.o.

- Issuer: NFCtron s.r.o. (vatPayer)
- Client: Acme Czech s.r.o. (vatPayer)
- Service: 80h backend development @ 1500 CZK/h
- Mode: `regular`
- Supplies abroad: `none`

Per-line:

```
quantity:                   80
unitPriceWithoutVat:    1 500.00
lineSubtotal:         120 000.00     (= 80 * 1500)
vatRate:                    21
lineVat:               25 200.00     (= 120 000 * 0.21)
lineTotal:            145 200.00
```

Totals:

```
subtotal:             120 000.00
vatBreakdown:        [{ rate: 21, base: 120 000, vat: 25 200 }]
vatTotal:              25 200.00
total:                145 200.00
```

PDF shows the standard breakdown table. ISDOC has one `<TaxTotal>` for rate 21 %.

### Example 2 — Construction reverse charge (PDP)

- Issuer: Stavby s.r.o. (vatPayer)
- Client: Acme Czech s.r.o. (vatPayer)
- Service: bathroom renovation in a non-residential office, 250 000 CZK
- Mode: `reverse_charge`
- Supplies abroad: `none`
- Legal note: "Daň odvede zákazník dle § 92e zákona č. 235/2004 Sb."

Per-line: `vatRate = 0`, `lineVat = 0`, `lineTotal = lineSubtotal = 250 000`.

Totals: `subtotal = 250 000`, `vatTotal = 0`, `total = 250 000`. The `vatBreakdown` has one entry at `rate: 0`.

PDF shows the legal note prominently, no "Rekapitulace DPH" table (or it's hidden because `vatTotal = 0`). ISDOC marks `<TaxScheme>` with reverse-charge.

### Example 3 — Mixed-rate invoice (21 + 12)

- Issuer: Hotel s.r.o. (vatPayer, regular mode)
- Client: domestic, vatPayer
- Lines:
  1. Accommodation 2 nights @ 2000 CZK → `vatRate: 12`
  2. Conference room hire @ 5000 CZK → `vatRate: 21`

Per-line:

```
Item 1:  base 4 000     vatRate 12   vat 480     total 4 480
Item 2:  base 5 000     vatRate 21   vat 1 050   total 6 050
```

Totals:

```
subtotal:                9 000
vatBreakdown:
  - rate 12, base 4 000, vat 480
  - rate 21, base 5 000, vat 1 050
vatTotal:                1 530
total:                  10 530
```

The PDF table has one row per rate.

### Example 4 — Neplátce DPH freelancer

- Issuer: Jan Novák (OSVČ, _not_ vatPayer)
- Client: Acme Czech s.r.o.
- Service: 10h consulting @ 1000 CZK
- Mode: `regular` (forced by `vatPayer = false`)
- Supplies abroad: `none`

Per-line: `vatRate = 0`, `lineVat = 0`, `lineTotal = 10 000`. No DIČ on the issuer block. PDF prints "Nejsem plátce DPH" near the totals. ISDOC declares the issuer as a non-VAT-payer.

### Example 5 — Cross-border B2B EU service (reverse charge)

- Issuer: Czech consultant s.r.o. (vatPayer)
- Client: German GmbH (vatPayer in DE, has a valid VAT ID — `client.dic = 'DE123456789'`)
- Service: marketing consulting, 5000 EUR worth of work but invoiced in CZK at issuer's chosen rate

> Note: CZK / EUR / USD invoicing is supported without FX conversion (ADR 0026). CNB rate snapshots and ISDOC foreign-currency fields remain a follow-up.

Mode: `reverse_charge`, supplies abroad: `eu`. Item has `vatRate = 0`. Legal note: "Reverse-charge: customer to account for VAT (Art. 196 of Directive 2006/112/EC)." ISDOC tagged as EU intracommunity service.

## Anti-patterns / common mistakes

- **Charging Czech VAT to a foreign VAT-payer for an EU B2B service.** Wrong — should be reverse charge.
- **Setting DUZP > issueDate to "match" a delayed delivery.** The legally correct path is to set DUZP = delivery date, even if it's in the past.
- **Mixing reverse-charge and standard lines on the same invoice.** Not supported by ISDOC and a domain-level error in our schema (enforced by the cross-field rule on `vat.mode`).
- **Issuing a credit note without referencing the corrected invoice.** Schema enforces `correctedInvoiceNumber` for `docType = 'credit_note'`.

## References

- Zákon č. 235/2004 Sb., o dani z přidané hodnoty
- [Kurzy.cz — DPH 2026](https://www.kurzy.cz/dph/)
- [ainvoice — Sazby DPH 2026](https://ainvoice.cz/blog/sazby-dph-2026/)
- [iDoklad — Sazby DPH](https://www.idoklad.cz/blog/sazby-dph-v-cesku-prehled-pro-nove-platce)
- [DokladBot (EN) — VAT Rates 2026](https://www.dokladbot.cz/blog/en/vat-rates-2026-what-falls-under-12-and-what-under-21)

## Open VAT questions

### TODO(plan-3): legal-note defaults

We hard-code the default reverse-charge legal note text per scenario. Make these editable per issuer (so a contractor can pick the §92e wording always) — Plan 5 issuer settings.

### Resolved (Plan 2): rounding in `vatBreakdown`

Per rate: **`base = sum(lineSubtotal)`** for lines at that rate (each `lineSubtotal` is already `round2(quantity × unitPrice)`), then **`vat = round2(base × rate / 100)`**. See `calcTotals` in `packages/invoice-core`; line-level VAT is reconciled to the bucket when rounded line sums differ (last line per rate absorbs the penny).

### TODO(plan-9): identifikovaná osoba edge case

Identified-person status sits between _plátce_ and _neplátce_. They have a DIČ, don't charge domestic VAT, but participate in VIES/EU reverse charge. Modeled implicitly today (issuer marked `vatPayer = false` but with a `dic`). Decide if we add an explicit flag in MVP polish.
