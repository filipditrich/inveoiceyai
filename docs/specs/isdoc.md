# ISDOC 6.0.2 export specification

## Goal

Serialize a validated [`Invoice`](../../packages/invoice-core/src/schema.ts) to **ISDOC 6.0.2** XML (`http://isdoc.cz/namespace/2013`), suitable for accounting importers, and **validate** output against the official invoice XSD in automated tests.

## XSD vendoring

| File | Source |
| --- | --- |
| `packages/invoice-core/assets/schemas/isdoc-invoice-6.0.2.xsd` | Official schema from MVČR distribution; mirrored at `https://raw.githubusercontent.com/isdoc/isdoc.github.io/main/xsd/isdoc-invoice-6.0.2.xsd` (same checksum as bundled file; update when MV publishes new revision). |

The schema is **self-contained** (no external `xs:import`). Root element **`Invoice`** in the default namespace `http://isdoc.cz/namespace/2013`; `xmlns:xsi`, `xmlns:xs` omitted except `xsi` if needed — follow generated pattern with default namespace prefixes.

## XSD validation approach (Bun + Vitest)

- **Implementation:** **`xmllint-wasm`** (pure WASM xmllint; no JVM; no OS `xmllint` binary dependency).
- **Test helper:** initialize wasm once (`XmlLint.init`), validate `(xmlString, xsdFilesystemMap)` mapping virtual paths so `xmllint --schema invoice.xsd out.xml` works per library API (see library README — often `schemas: [{ name, content }]`).

If wasm init fails unexpectedly, CI should fail visibly (no silent skip).

## API

| Name | Output |
| --- | --- |
| `renderIsdoc(invoice)` | `string` (XML declaration + document), UTF-8, Unix `LF` only, no BOM. |

## Stable serialization

- **Builder:** `xmlbuilder2` with deterministic child order (explicit sequence matching XSD `Invoice` content model order).
- **Dates:** `YYYY-MM-DD` as in `meta.*` (ISO date strings).
- **Numbers:** decimal amounts with `.` separator, no thousands separators; two fractional digits for money where applicable.
- **Root:** `<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.2">…</Invoice>` — `version` is **required** by the XSD.

## `DocumentType` mapping (`meta.docType`)

| Invoicey | ISDOC `DocumentType` (integer) |
| --- | --- |
| `invoice` | `1` |
| `credit_note` | `2` (dobropis) |
| `proforma` | `4` (nedaňový zálohový list) |
| `advance` | `5` (daňový zálohový list) |

`3` (vrubopis) and `6`/`7` unused in MVP.

## Required header fields (subset)

Per XSD `Invoice` sequence (non-exhaustive — implementation fills all **required** elements):

| Element | Rule |
| --- | --- |
| `DocumentType` | Above mapping |
| `ID` | `meta.number` |
| `UUID` | Deterministic UUID **v5** from namespace URL + `issuer.id` + `meta.number` + `meta.issueDate` (stable across re-renders) |
| `IssueDate` | `meta.issueDate` |
| `TaxPointDate` | `meta.duzp` for doc types **1–3,5–6**; for `proforma` (4) **omit** `TaxPointDate` (`minOccurs=0`) |
| `VATApplicable` | `issuer.vatPayer` mapped to XSD boolean lexical (`true` / `false`) |
| `ElectronicPossibilityAgreementReference` | **Required** in XSD → emit empty string (`<ElectronicPossibilityAgreementReference></ElectronicPossibilityAgreementReference>`) |

## Monetary / currency defaults

For MVP invoices are **always CZK** (`meta.currency === 'CZK'`):

| Element | Value |
| --- | --- |
| `LocalCurrencyCode` | `CZK` |
| `CurrRate` / `RefCurrRate` | `1` |
| Omit `ForeignCurrencyCode` |

## Parties

### `AccountingSupplierParty`

Map from `issuer`: legal name (`PartyName`), `PostalAddress` (street, city, zip, country), `PartyIdentification/ID` = IČO, `PartyTaxScheme/CompanyID` = DIČ when `vatPayer && dic`, `Contact/ElectronicMail` = `contactEmail`.

### `AccountingCustomerParty`

Map from `client`: name, address (country ISO-2 from schema), `PartyIdentification/ID` = IČO when present, otherwise **empty** `<ID></ID>` (do not invent a fake IČO). `PartyTaxScheme/CompanyID` when `dic` is set.

## Lines (`InvoiceLines` / `InvoiceLine`)

For each `items[]` (sorted by `position`):

- `ID`: string of `position`
- `InvoicedQuantity` = `quantity`, `@unitCode` = `HUR` for hour-like units (`h` / `hod` / `hod.`), else `C62`
- `LineExtensionAmount` = `lineSubtotal` (without VAT)
- `LineExtensionAmountTaxInclusive` = `lineTotal`
- `LineExtensionTaxAmount` = `lineVat`
- `UnitPrice` / `UnitPriceTaxInclusive` from line amounts
- `ClassifiedTaxCategory`:
  - `Percent` = line `vatRate` (forced `0` when reverse charge)
  - `VATCalculationMethod` = `0` (from the bottom)
  - `VATApplicable` when issuer is a VAT payer (or reverse charge / OSS)
  - **Reverse charge:** `LocalReverseCharge/LocalReverseChargeCode` = `vat.localReverseChargeCode` (ISDOC číselník, e.g. `4` = construction/assembly — **not** a §92x paragraph)
  - Optional line `VATNote` from `vat.legalNote` on reverse-charge lines
- `Item/Description` = `description`

## Totals

- `TaxTotal`: one `TaxSubTotal` per `totals.vatBreakdown[]` with taxable / tax / inclusive amounts, already-claimed zeros, difference = current amounts, and `TaxCategory` (`Percent`, `TaxScheme` = `VAT`, plus `LocalReverseChargeFlag` when reverse charge).
- `LegalMonetaryTotal`: `TaxExclusiveAmount`, `TaxInclusiveAmount`, already-claimed zeros, difference amounts, `PaidDepositsAmount` = `0`, `PayableAmount` = `totals.total` (negative for credit notes).

## `PaymentMeans`

| `payment.method` | `PaymentMeansCode` | `Details` |
| --- | --- | --- |
| `transfer` | `42` | Transfer branch: `PaymentDueDate`, BankAccount group (`ID` = local account number, `BankCode`, `Name`, `IBAN`, `BIC` — empty string when BIC unknown; XSD requires the element), then optional `VariableSymbol` / `ConstantSymbol` / `SpecificSymbol` |
| `cash` | `10` | Cash/card branch: stub `DocumentID` + `IssueDate` |
| `card` | `48` | Same stub branch as cash |

`parseCzAccountNumber` splits `accountNumber` (`prefix-num/bank` or `num/bank`); invalid input **throws** (validated invoices already match `BankAccountSchema`).

## Notes

- Concatenate `vat.legalNote`, `notes`, credit reference `correctedInvoiceNumber` into one `Note` (newlines).
- **Reverse charge / OSS:** `TaxSubTotal` + `Note` / `VATNote` carry legal text from `vat.legalNote` or defaults from [vat-czech.md](../domain/vat-czech.md).

## ISDOC embedded in PDF

`renderInvoicePdf(invoice)` attaches ISDOC XML inside the PDF (same pattern as NFCtron order invoices):

1. Render the page with `@react-pdf/renderer`.
2. Serialize with `renderIsdoc`.
3. `pdf-lib` `attach()` as **`invoice.isdoc`** (`application/xml`) → Catalog `/AF` + `/Names/EmbeddedFiles`.

Recommended download suffix: `-isdoc.pdf`. Standalone `.isdoc` via `renderIsdoc` remains available.

## Import (parse)

| API | Role |
| --- | --- |
| `extractIsdocFromPdf(bytes)` | Read EmbeddedFiles / AF attachment named `invoice.isdoc` (or `*.isdoc`) |
| `parseIsdoc(xml, { issuer })` | Map ISDOC 6.0.x → `InvoiceSchema` (issuer locked from workspace) |
| `readPdfOriginHints(bytes)` | Producer/Creator/Keywords for origin heuristics |

Round-trip tests: Invoicey fixtures `renderIsdoc` → `parseIsdoc`. Product flow: [`invoice-import.md`](./invoice-import.md).

Not claimed: full official ISDOC.PDF / PDF/A-3a (tagged PDF, XMP `pdfaid`, ICC OutputIntent, Filespec `/AFRelationship`). Public-admin `metadata-invoice-nsessl.xml` and `.isdocx` are out of scope.

## MVP limitations

- **OSS:** until schema adds per-line destination country, ISDOC uses client country and line rates; `Note` states OSS.
- **BuildingNumber:** always empty; street line may include the descriptive/orientational number.
- **PDF/A-3 / veraPDF ISDOC.PDF profile:** not claimed; PDF only embeds the XML attachment.
- **NSSSL metadata / ISDOCX:** not generated.

## References

- [domain/invoice-schema.md](../domain/invoice-schema.md) (mapping table extended here)
- [architecture.md](../architecture.md) — `xmlbuilder2`
- ISDOC HTML doc: `https://isdoc.github.io/doc-cs/isdoc-invoice-6.0.2.html`
