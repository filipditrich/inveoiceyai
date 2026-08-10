# Invoice schema — the contract

`InvoiceSchema` is the **single source of truth** for what an invoice is in Invoicey. Every code path that produces or consumes an invoice — the UI builder, server actions, the future MCP tool, the future Slack handler, the PDF renderer, the ISDOC generator — parses or constructs values that pass `InvoiceSchema.safeParse`.

This doc is the contract. The Zod implementation in `packages/invoice-core/src/schema.ts` is its concrete form. If they disagree, the doc wins until a new ADR is filed.

See also: [`vat-czech.md`](./vat-czech.md), [`numbering.md`](./numbering.md), [`status-engine.md`](./status-engine.md), [`snapshots.md`](./snapshots.md).

## Top-level shape

```ts
const InvoiceSchema = z.object({
	meta: InvoiceMetaSchema,
	issuer: IssuerSnapshotSchema,
	client: ClientSnapshotSchema,
	vat: InvoiceVatSchema,
	payment: PaymentSchema,
	items: z.array(InvoiceItemSchema).min(1),
	totals: TotalsSchema,
	notes: z.string().max(2000).optional(),
	customization: InvoiceCustomizationSchema.optional(),
});

type Invoice = z.infer<typeof InvoiceSchema>;
```

Every nested schema is described below. All shapes are intentionally explicit — no implicit defaults at parse time, defaults are applied by the caller (server action, UI form) before validation.

## `meta` — document identification

```ts
const InvoiceMetaSchema = z.object({
	docType: z.enum(['invoice', 'proforma', 'advance', 'credit_note']),
	number: z.string().min(1).max(64),
	issueDate: z.string().date(),
	dueDate: z.string().date(),
	/** Datum uskutečnění zdanitelného plnění */
	duzp: z.string().date(),
	language: z.literal('cs'),
	currency: z.literal('CZK'),
	/** Reference to the original invoice (only for credit_note) */
	correctedInvoiceNumber: z.string().min(1).max(64).optional(),
});
```

### Validation rules

- `docType = 'credit_note'` requires `correctedInvoiceNumber` to be set
- `docType ∈ {'invoice','credit_note'}` requires `duzp` to be present (always)
- `docType ∈ {'proforma','advance'}` allows `duzp` to equal `issueDate` (proforma/advance are not tax documents — see [`vat-czech.md`](./vat-czech.md))
- `dueDate >= issueDate`
- `duzp` may be ≤ or ≥ `issueDate` (DUZP can precede issue date in practice when invoicing for past work)
- `number` is opaque text — formatting is decided by the issuer's [numbering scheme](./numbering.md), but at the schema level any non-empty string ≤ 64 chars is valid

## `issuer` — the supplier (snapshot at issue time)

```ts
const IssuerSnapshotSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(200),
	ico: IcoSchema,
	dic: DicSchema.optional(),
	address: AddressSchema,
	bank: BankAccountSchema,
	vatPayer: z.boolean(),
	logoUrl: z.string().url().optional(),
	stampUrl: z.string().url().optional(),
	signatureUrl: z.string().url().optional(),
	registryNote: z.string().max(500).optional(),
});
```

Where:

```ts
const IcoSchema = z
	.string()
	.regex(/^\d{8}$/, 'IČO must be exactly 8 digits');

const DicSchema = z
	.string()
	.regex(/^CZ\d{8,10}$/, 'DIČ must be CZ followed by 8–10 digits');

const AddressSchema = z.object({
	street: z.string().min(1).max(200),
	city: z.string().min(1).max(100),
	zip: z.string().regex(/^\d{3} ?\d{2}$/, 'PSČ must be 5 digits'),
	country: z.literal('CZ'),
});

const BankAccountSchema = z.object({
	/** Czech account number in canonical form `prefix-number/bankCode` */
	accountNumber: z.string().regex(/^(?:\d{1,6}-)?\d{1,10}\/\d{4}$/),
	iban: z.string().regex(/^CZ\d{22}$/),
	bic: z.string().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/).optional(),
});
```

### Why a snapshot?

`issuer` is **frozen at issue time** — it captures the issuer business as it was on the issue date, even if the underlying `issuer_businesses` row is later edited (rebrand, address change, switching banks). See [`snapshots.md`](./snapshots.md) for the full policy.

### `registryNote`

The "zápis v obchodním rejstříku" line that Czech invoices typically carry, e.g.:

> Společnost zapsaná v obchodním rejstříku vedeném Krajským soudem v Brně, oddíl C, vložka 12345.

Optional — sole traders (OSVČ on a živnostenský list) typically don't have one and instead show:

> Fyzická osoba zapsaná v živnostenském rejstříku.

UI lets the issuer save a default note that's used unless overridden per invoice (post-MVP override).

## `client` — the customer (snapshot at issue time)

```ts
const ClientSnapshotSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(200),
	ico: IcoSchema.optional(),
	dic: DicSchema.optional(),
	address: ClientAddressSchema,
	contactEmail: z.string().email().optional(),
});

const ClientAddressSchema = z.object({
	street: z.string().min(1).max(200),
	city: z.string().min(1).max(100),
	zip: z.string().regex(/^\d{3} ?\d{2}|[A-Z0-9 \-]{3,10}$/),
	/** ISO 3166-1 alpha-2 — typically 'CZ' for MVP but allowed for cross-border invoices */
	country: z.string().regex(/^[A-Z]{2}$/),
});
```

Notes:

- `ico` is optional because clients can be foreign or natural persons without an IČO
- For Czech B2B invoices, IČO is effectively mandatory and the UI enforces it; the *schema* allows omission so OBO/self-billing and foreign clients fit
- Address allows non-CZ ZIP/format because we want to model invoicing abroad even though MVP language is Czech-only

Like `issuer`, `client` is a snapshot — see [`snapshots.md`](./snapshots.md).

## `vat` — VAT mode at invoice level

```ts
const InvoiceVatSchema = z.object({
	mode: z.enum(['regular', 'reverse_charge', 'oss']),
	suppliesAbroad: z.enum(['none', 'eu', 'non_eu']),
	/** Free-text legal note shown on the PDF, e.g. "Daň odvede zákazník dle § 92a..." */
	legalNote: z.string().max(500).optional(),
});
```

Refer to [`vat-czech.md`](./vat-czech.md) for the full semantics and per-mode worked examples.

### Cross-field rules

- `mode = 'regular' && suppliesAbroad = 'none'` → standard domestic invoice
- `mode = 'reverse_charge'` → every line item must have `vatRate = 0` (the recipient computes VAT)
- `mode = 'oss' && suppliesAbroad = 'none'` is invalid (OSS only applies to cross-border B2C)
- `issuer.vatPayer = false` → `mode` must be `'regular'`, every line `vatRate = 0`, no DPH columns rendered

## `payment` — payment instructions

```ts
const PaymentSchema = z.object({
	method: z.enum(['transfer', 'cash', 'card']),
	bankAccount: BankAccountSchema.optional(),
	/** Czech variable symbol — typically the numeric portion of meta.number */
	variableSymbol: z.string().regex(/^\d{1,10}$/).optional(),
	constantSymbol: z.string().regex(/^\d{1,4}$/).optional(),
	specificSymbol: z.string().regex(/^\d{1,10}$/).optional(),
	/** Multi-line text above the payment block. Markdown: `**bold**`, `*italic*`, `_italic_`. */
	instructionsBefore: z.string().max(2000).optional(),
	/** Multi-line text below the payment block (above `notes`). Same markdown subset. */
	instructionsAfter: z.string().max(2000).optional(),
});
```

Validation:

- `method = 'transfer'` requires `bankAccount` (else PDF can't render the payment block / SPAYD QR)
- `method = 'cash'` or `'card'` allows `bankAccount` to be absent
- `bankAccount` is typically copied from `issuer.bank` at issue time (server-side default), but the schema allows overriding (e.g. an issuer with multiple bank accounts)
- `instructionsBefore` / `instructionsAfter` support basic markdown (`**bold**`, `*italic*`, `_italic_`); ISDOC includes them (markers stripped) in `Note` when set
- They do not replace `notes` — `notes` still renders as „Poznámka“ below the payment section

## `items` — line items

```ts
const InvoiceItemSchema = z.object({
	position: z.number().int().min(1),
	description: z.string().min(1).max(500),
	quantity: z.number().positive(),
	/** Free-form unit label: 'ks' (pieces), 'h' (hours), 'měs.' (months), '%', etc. */
	unit: z.string().min(1).max(20),
	unitPriceWithoutVat: z.number().nonnegative(),
	vatRate: VatRateSchema,
	/** Pre-computed totals for this line — required and re-validated server-side */
	lineSubtotal: z.number().nonnegative(),
	lineVat: z.number().nonnegative(),
	lineTotal: z.number().nonnegative(),
});

const VatRateSchema = z.union([
	z.literal(0),
	z.literal(12),
	z.literal(21),
	/** Custom positive rate — used for backdated invoices with historical rates (15, 10) */
	z.number().min(0).max(100).int(),
]);
```

### Invariants checked by `calcTotals` (Plan 2)

For every item:

```ts
lineSubtotal === round2(quantity * unitPriceWithoutVat);
lineVat       === round2(lineSubtotal * vatRate / 100);
lineTotal     === round2(lineSubtotal + lineVat);
```

`round2` = banker's rounding to 2 decimals (`Math.round` then `/100`). `calcTotals` produces these and the server action re-runs it before persisting; the schema accepts the user-provided values but the server treats them as advisory.

The `position` field is 1-indexed and dense (no gaps), reordered server-side after persistence.

## `totals` — aggregate

```ts
const TotalsSchema = z.object({
	subtotal: z.number().nonnegative(),
	vatBreakdown: z.array(VatBreakdownEntrySchema),
	vatTotal: z.number().nonnegative(),
	total: z.number().nonnegative(),
});

const VatBreakdownEntrySchema = z.object({
	rate: z.number().min(0).max(100),
	base: z.number().nonnegative(),
	vat: z.number().nonnegative(),
});
```

Invariants:

- `subtotal === sum(items.lineSubtotal)`
- For each `rate r` present in items: one entry in `vatBreakdown` with `base = sum(items where vatRate=r).lineSubtotal` and `vat = round2(base * r / 100)`
- `vatTotal === sum(vatBreakdown.vat)`
- `total === subtotal + vatTotal`

The `vatBreakdown` array is what the PDF renders as the "Rekapitulace DPH" block.

## `customization` — issuer-level rendering tweaks

```ts
const InvoiceCustomizationSchema = z.object({
	accentColor: z
		.enum(['neutral', 'blue', 'green', 'amber', 'rose', 'violet'])
		.default('neutral'),
	showStamp: z.boolean().default(false),
	showSignature: z.boolean().default(false),
});
```

Intentionally narrow. We're shipping one well-designed PDF template, not a template editor. See [decision 0004](../decisions/0004-pdf-react-pdf-renderer.md).

## End-to-end JSON example: standard domestic invoice

A real `Invoice` produced by an issuer that is `vatPayer = true`, regular VAT mode, paying via transfer:

```json
{
	"meta": {
		"docType": "invoice",
		"number": "20260001",
		"issueDate": "2026-05-03",
		"dueDate": "2026-05-17",
		"duzp": "2026-05-03",
		"language": "cs",
		"currency": "CZK"
	},
	"issuer": {
		"id": "ca8b8d4e-2e7e-4f6a-9b7d-1f9c1234abcd",
		"name": "Filip Ditrich",
		"ico": "12345678",
		"dic": "CZ12345678",
		"address": {
			"street": "Na Příkopě 14",
			"city": "Praha",
			"zip": "110 00",
			"country": "CZ"
		},
		"bank": {
			"accountNumber": "1920014539/0800",
			"iban": "CZ6508000000192000145399",
			"bic": "GIBACZPX"
		},
		"vatPayer": true,
		"logoUrl": "https://cdn.uploadthing.com/abc123/logo.png",
		"registryNote": "Fyzická osoba zapsaná v živnostenském rejstříku."
	},
	"client": {
		"id": "5bc1d5a7-0c58-4cda-a1f6-4ad9876543ff",
		"name": "NFCtron s.r.o.",
		"ico": "07654321",
		"dic": "CZ07654321",
		"address": {
			"street": "Křížová 2598/4",
			"city": "Brno",
			"zip": "603 00",
			"country": "CZ"
		},
		"contactEmail": "billing@nfctron.com"
	},
	"vat": {
		"mode": "regular",
		"suppliesAbroad": "none"
	},
	"payment": {
		"method": "transfer",
		"bankAccount": {
			"accountNumber": "1920014539/0800",
			"iban": "CZ6508000000192000145399",
			"bic": "GIBACZPX"
		},
		"variableSymbol": "20260001",
		"constantSymbol": "0308"
	},
	"items": [
		{
			"position": 1,
			"description": "Vývojové práce za duben 2026 — backend",
			"quantity": 80,
			"unit": "h",
			"unitPriceWithoutVat": 1500,
			"vatRate": 21,
			"lineSubtotal": 120000,
			"lineVat": 25200,
			"lineTotal": 145200
		}
	],
	"totals": {
		"subtotal": 120000,
		"vatBreakdown": [
			{ "rate": 21, "base": 120000, "vat": 25200 }
		],
		"vatTotal": 25200,
		"total": 145200
	},
	"customization": {
		"accentColor": "neutral",
		"showStamp": false,
		"showSignature": true
	}
}
```

## JSON example: reverse-charge B2B (přenesená daňová povinnost)

Construction service to a Czech VAT-payer client, both registered for VAT:

```json
{
	"meta": {
		"docType": "invoice",
		"number": "20260002",
		"issueDate": "2026-05-03",
		"dueDate": "2026-05-17",
		"duzp": "2026-04-30",
		"language": "cs",
		"currency": "CZK"
	},
	"issuer": { "...": "as above" },
	"client": { "...": "as above (Czech, vatPayer)" },
	"vat": {
		"mode": "reverse_charge",
		"suppliesAbroad": "none",
		"legalNote": "Daň odvede zákazník dle § 92a zákona č. 235/2004 Sb."
	},
	"payment": { "method": "transfer", "...": "as above" },
	"items": [
		{
			"position": 1,
			"description": "Stavební práce — rekonstrukce kanceláří",
			"quantity": 1,
			"unit": "ks",
			"unitPriceWithoutVat": 250000,
			"vatRate": 0,
			"lineSubtotal": 250000,
			"lineVat": 0,
			"lineTotal": 250000
		}
	],
	"totals": {
		"subtotal": 250000,
		"vatBreakdown": [
			{ "rate": 0, "base": 250000, "vat": 0 }
		],
		"vatTotal": 0,
		"total": 250000
	}
}
```

## JSON example: credit note (dobropis)

Reduces invoice `20260001` by one line (returned hours):

```json
{
	"meta": {
		"docType": "credit_note",
		"number": "DOB20260001",
		"issueDate": "2026-05-10",
		"dueDate": "2026-05-24",
		"duzp": "2026-05-10",
		"language": "cs",
		"currency": "CZK",
		"correctedInvoiceNumber": "20260001"
	},
	"issuer": { "...": "as above" },
	"client": { "...": "as above" },
	"vat": { "mode": "regular", "suppliesAbroad": "none" },
	"payment": { "method": "transfer", "...": "as above" },
	"items": [
		{
			"position": 1,
			"description": "Storno 8 h — duplicitně fakturováno",
			"quantity": -8,
			"unit": "h",
			"unitPriceWithoutVat": 1500,
			"vatRate": 21,
			"lineSubtotal": -12000,
			"lineVat": -2520,
			"lineTotal": -14520
		}
	],
	"totals": {
		"subtotal": -12000,
		"vatBreakdown": [
			{ "rate": 21, "base": -12000, "vat": -2520 }
		],
		"vatTotal": -2520,
		"total": -14520
	}
}
```

> Note: credit notes are the **only** documents allowed to have negative `quantity`, `subtotal`, `vatTotal`, and `total`. The schema enforces this in Plan 2 via a refinement: `quantity` is `z.number().positive()` for non–credit-note items and `z.number().refine(x => x !== 0)` for credit-note items.

## Mapping to the database

Each invoice is persisted as:

- one row in `invoices` (most fields including `issuer_snapshot` and `client_snapshot` as JSONB)
- N rows in `invoice_items`
- the full Zod-validated payload also persisted as `invoices.payload_json` for round-tripping

The DB schema mirrors the Zod schema; see Plan 1 for the Drizzle implementation.

## Mapping to ISDOC

ISDOC 6.0.2 fields map roughly:

| `InvoiceSchema` field | ISDOC element |
| --- | --- |
| `meta.docType` | `<DocumentType>` |
| `meta.number` | `<ID>` |
| `meta.issueDate` | `<IssueDate>` |
| `meta.duzp` | `<TaxPointDate>` |
| `meta.dueDate` | `<PaymentMeans><DueDate>` |
| `issuer.*` | `<AccountingSupplierParty>` |
| `client.*` | `<AccountingCustomerParty>` |
| `items[*]` | `<InvoiceLines><InvoiceLine>` |
| `totals.*` | `<LegalMonetaryTotal>`, `<TaxTotal>` |
| `vat.legalNote` | `<Note>` |

Full mapping lives in `specs/isdoc.md` (written before Plan 3).

## Open schema questions

### Resolved (Plan 2): credit-note sign convention

**Decision:** Credit notes use **negative** `quantity`, line amounts, and aggregate totals where the corrected document reduces amounts. `InvoiceSchema` refines `docType === 'credit_note'` accordingly. `calcTotals` supports negative quantities for the same math.

### Resolved (Plan 2): rounding policy

**Decision:** **`round2(n) = Math.round(n * 100) / 100`** (half away from zero at 2 dp in typical JS float use). Per-rate VAT in totals uses the same `round2` on the aggregated base per [`vat-czech.md`](./vat-czech.md); line VAT may be penny-adjusted to match the bucket on the last line of each rate group in `calcTotals`.

### TODO(plan-3): proforma vs advance distinction

Both are non-tax documents. `advance` (zálohová faktura) maps to a specific lifecycle (advance payment + later daňový doklad k přijaté platbě); `proforma` is a generic payment request. PDF rendering and ISDOC may treat them identically; lifecycle differs only post-MVP. Confirm during Plan 3.
