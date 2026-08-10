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
| `UUID` | Deterministic UUID **v5** from namespace URL + `issuer.id` + `meta.number` (stable across re-renders) |
| `IssueDate` | `meta.issueDate` |
| `TaxPointDate` | `meta.duzp` for doc types **1–3,5–6**; for `proforma` (4) **omit** `TaxPointDate` (`minOccurs=0`) |
| `VATApplicable` | `issuer.vatPayer` mapped to XSD boolean lexical (`true` / `false`) |
| `ElectronicPossibilityAgreementReference` | **Required** in XSD → emit empty string (`<ElectronicPossibilityAgreementReference></ElectronicPossibilityAgreementReference>` or self-closing with empty simple content avoided — use explicit empty body) |

## Monetary / currency defaults

For MVP invoices are **always CZK** (`meta.currency === 'CZK'`):

| Element | Value |
| --- | --- |
| `LocalCurrencyCode` | `CZK` |
| `CurrRate` / `RefCurrRate` | `1` |
| Omit `ForeignCurrencyCode` |

## Parties

### `AccountingSupplierParty`

Map from `issuer`: legal name (`PartyName`), `PostalAddress` (street, city, zip, country), `CompanyID` = IČO, `PartyTaxScheme` / `VATID` when `vatPayer && dic`, contact optional.

### `AccountingCustomerParty`

Map from `client`: name, address (country ISO-2 from schema), `CompanyID` when `ico`, tax ID when `dic` (support non-CZ VAT ID string shape).

## Lines (`InvoiceLines` / `InvoiceLine`)

For each `items[]` (sorted by `position`):

- `ID` or line id: string of `position`
- `InvoicedQuantity` = `quantity`
- `LineExtensionAmount` = `lineSubtotal` (without VAT)
- `TaxCategory` / `Percent` = `vatRate` with proper **TaxScheme**:
  - **Standard domestic:** `VAT` category S (or schema-allowed code for standard rate)
  - **Reverse charge:** category with `TaxExemptionReason` / scheme marking reverse charge (per XSD `TaxCategoryType` allowed values)
  - **Neplátce:** zero percent, exemption reason text

Line item description: `Item/Description` = `description`, unit `InvoicedQuantity/@unitCode` use free text mapping to `C62` (unit) or schema `unitCode` list — MVP use `C62` for generic pieces or map `unit` string to `HUR` for hours if `unit === 'h'`.

## Totals

- `TaxTotal`: one `TaxSubtotal` per `totals.vatBreakdown[]` with `TaxableAmount`, `TaxAmount`, `Percent`.
- `LegalMonetaryTotal`: `LineExtensionAmount`, `TaxExclusiveAmount`, `TaxInclusiveAmount`, `PayableAmount` aligned with `totals` (negative for credit notes).

## `PaymentMeans`

If `payment.method === 'transfer'` and `bankAccount`: `PaymentDueDate` = `meta.dueDate`, `PaymentMeansCode` = bank transfer, `ID` = variable symbol or empty, `FinancialAccount/ID` = IBAN, `FinancialInstitutionBranch/ID` = BIC if present.

## Notes

- Concatenate `vat.legalNote`, stripped `payment.instructionsBefore` / `payment.instructionsAfter`, `notes`, credit reference `correctedInvoiceNumber` into `Note` where useful (separate `Note` elements or single block with newlines — MVP: one `Note` with sections).
- **Reverse charge / OSS:** ensure `TaxSubtotal` + `Note` carry legal text from `vat.legalNote` or defaults from [vat-czech.md](../domain/vat-czech.md).

## MVP limitations

- **OSS:** until schema adds per-line destination country, ISDOC uses client country and line rates; `Note` states OSS.

## References

- [domain/invoice-schema.md](../domain/invoice-schema.md) (mapping table extended here)
- [architecture.md](../architecture.md) — `xmlbuilder2`
- ISDOC HTML doc: `https://isdoc.github.io/doc-cs/isdoc-invoice-6.0.2.html`
