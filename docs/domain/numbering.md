# Invoice numbering

Each issuer business defines, per document type, a **numbering scheme** that produces invoice numbers as new invoices are issued. The number lives on the invoice as `meta.number` (see [`invoice-schema.md`](./invoice-schema.md)).

## Goals

1. **Configurable per issuer** — Each issuer business sets its own scheme. UC1 explicitly requires multiple issuer businesses with independent counters
2. **Configurable per doc type** — Invoices, proformas, advance invoices, and credit notes can each have their own template and counter (most common: invoice and credit-note share a year, proforma has a separate sequence)
3. **Deterministic & previewable** — A user can see exactly what their next number will be before issuing, so they can spot mistakes before they're committed
4. **Atomic** — Concurrent issue actions never produce duplicate numbers
5. **Reset by year (optional)** — Most Czech businesses reset counters every January; some don't; both are supported

## Data model

```ts
const NumberingSchemeSchema = z.object({
	id: z.string().uuid(),
	issuerBusinessId: z.string().uuid(),
	docType: z.enum(['invoice', 'proforma', 'advance', 'credit_note']),
	template: z.string().min(1).max(64),
	resetPeriod: z.enum(['yearly', 'never']),
	counter: z.number().int().nonnegative(),
	counterYear: z.number().int().min(2000).max(9999).optional(),
	padding: z.number().int().min(1).max(10).default(4),
});
```

Persisted in `issuer_numbering_schemes` (see Plan 1 / Drizzle schema). Constraints:

- Unique on `(issuerBusinessId, docType)` — exactly one scheme per (issuer, doc type)
- `counterYear` is required if `resetPeriod = 'yearly'`, otherwise it's null

## Template tokens

The `template` field is a string with `{TOKEN}` placeholders. Supported tokens:

| Token | Substituted with | Example (issue date 2026-05-03, counter = 7, padding = 4) |
| --- | --- | --- |
| `{YYYY}` | 4-digit year of issue date | `2026` |
| `{YY}` | 2-digit year of issue date | `26` |
| `{MM}` | 2-digit month of issue date | `05` |
| `{DD}` | 2-digit day of issue date | `03` |
| `{####}` | counter, zero-padded — `padding` is the number of `#` chars | `0007` |
| `{ISSUER}` | issuer's `name` slug-cased, max 12 chars | `nfctron` |
| `{TYPE}` | doc-type abbreviation: `FV`, `PF`, `ZF`, `DOB` | `FV` |

Doc-type abbreviations (in Czech accounting practice):

| `docType` | Abbreviation | Czech name |
| --- | --- | --- |
| `invoice` | `FV` | Faktura vystavená |
| `proforma` | `PF` | Proformová faktura |
| `advance` | `ZF` | Zálohová faktura |
| `credit_note` | `DOB` | Dobropis (opravný daňový doklad) |

The `padding` field is metadata; the actual hash count in the template determines digit count. They're kept in sync by the UI (changing `padding` rewrites `{####}` → `{#####}`).

## Templates: examples

```
{YYYY}{####}              → 20260007        (most common; year + 4-digit counter)
{YY}{MM}{####}            → 26050007        (year-month-counter; resets monthly post-MVP)
F{YYYY}-{####}            → F2026-0007
{TYPE}-{YYYY}-{####}      → FV-2026-0007    (separate FV/PF/ZF/DOB streams)
{YYYY}/{####}             → 2026/0007       (slash separator — careful with URL safety)
```

The `template` is stored verbatim. Resolution happens at issue time.

## Resolution algorithm (Plan 2 implementation, pure)

```ts
function nextInvoiceNumber(scheme: NumberingScheme, issueDate: Date): string {
	const year = issueDate.getFullYear();
	const month = String(issueDate.getMonth() + 1).padStart(2, '0');
	const day = String(issueDate.getDate()).padStart(2, '0');

	// Determine the counter to use *for this issuance*.
	// (Persistence + atomic increment happens in the caller; see "Atomicity" below.)
	let next = scheme.counter + 1;
	if (scheme.resetPeriod === 'yearly' && scheme.counterYear !== year) {
		next = 1;
	}

	const tokens: Record<string, string> = {
		'{YYYY}': String(year),
		'{YY}': String(year).slice(-2),
		'{MM}': month,
		'{DD}': day,
		'{ISSUER}': slugify(scheme.issuerName).slice(0, 12),
		'{TYPE}': docTypeAbbr(scheme.docType),
	};

	let result = scheme.template;
	for (const [k, v] of Object.entries(tokens)) {
		result = result.replaceAll(k, v);
	}

	// Counter token is special — it has variable hash count
	result = result.replace(/\{(#+)\}/g, (_, hashes: string) => {
		return String(next).padStart(hashes.length, '0');
	});

	return result;
}
```

Inputs are pure: `scheme` (the row), `issueDate` (which year drives reset), `slugify` and `docTypeAbbr` are deterministic helpers. The function returns the *would-be* next number. Persistence happens in the server action.

## Atomicity

When a user issues an invoice, two things must happen *atomically*:

1. The numbering counter increments (and possibly resets to 1 if the year changed)
2. The invoice row is inserted with the resolved number

A naive implementation reads the counter, computes the number, and writes both → race condition under concurrent issuance, two invoices get the same number. Since the data model has a unique constraint on `(issuer_id, number)` (added in Plan 1), the second insert would fail and the user would see an error — but we'd rather not get there.

### MVP approach (single user, no auth)

Even with one user, double-clicking "Issue" or two browser tabs can race. We use a transaction with `SELECT ... FOR UPDATE`:

```sql
BEGIN;
  SELECT counter, counter_year FROM issuer_numbering_schemes
    WHERE id = $schemeId
    FOR UPDATE;
  -- compute new counter / number in app
  UPDATE issuer_numbering_schemes
    SET counter = $newCounter, counter_year = $issueYear
    WHERE id = $schemeId;
  INSERT INTO invoices (..., number = $resolvedNumber, ...);
COMMIT;
```

Postgres acquires a row-level lock on the scheme; concurrent issuers serialize. This is the same pattern that survives multi-user mode in Plan 14 — no rework needed.

### Failure / rollback

If the invoice insert fails after the counter update (validation error, constraint violation), the whole transaction rolls back. Counter does not advance. Numbering stays gapless.

### Gapless numbering

Czech invoicing practice strongly prefers gapless sequences (`...0006, 0007, 0008...`) without holes. The transactional approach above guarantees this for successful issuances. **Drafts do not consume numbers** — a number is only allocated at the *Issue* action, not at *Save Draft*.

If an issued invoice is later canceled (Plan 6 introduces `status = 'cancelled'`), the number stays consumed and the canceled invoice remains in records. This matches Czech accounting practice: you don't reuse a number, you cancel and continue.

### TODO(plan-2): jump-the-counter feature

When importing existing invoices from another tool, you may need to start at counter 47 mid-year. The schema's `counter` field is `nonnegative` so this is mechanically possible by setting it directly in the issuer settings UI (Plan 5). The UI must warn that doing so can produce gaps (between 1 and 47 if no manually-numbered records exist).

## Per-doc-type counters

Each `(issuer, docType)` pair has its own counter. So issuing 1 invoice and 2 proformas in 2026 produces:

```
invoice  : counter = 1, number = "20260001"
proforma : counter = 2, number = "26-PF-0002"   (using template {YY}-{TYPE}-{####})
```

Templates do not have to share format across doc types. The UI lets the user configure each independently, but offers a default that mirrors the invoice template with a `{TYPE}` prefix.

## Reset semantics in detail

### `resetPeriod: 'yearly'`

When an invoice is issued and `issueDate.year !== scheme.counterYear`, the counter resets to 1 and `counterYear` is updated to the issue year.

This handles the year-rollover case:

- Last invoice of 2025 was `20250143` (counter = 143, counterYear = 2025)
- First issue in 2026 has `issueDate.year = 2026`, so the counter becomes 1 → number `20260001`, counterYear = 2026

It also handles the more obscure case of issuing a back-dated invoice into a previous year (e.g. issuing a forgotten 2024 invoice in 2026). In that case `issueDate.year = 2024`, which is neither 2026 (current) nor 2025 (last issued). We do **not** support back-dated issuance with reset semantics — back-dated counter computation is non-trivial (you'd have to find the last invoice from that year and continue its sequence). The UI prevents this by requiring `issueDate.year >= scheme.counterYear`.

### TODO(plan-5): back-dated yearly reset

If a user really needs to back-date an invoice into a year where their counter has already moved on, the simplest path is to let them enter the number manually (override `meta.number` in the builder) for that one invoice. Auto-numbering remains forward-only.

### `resetPeriod: 'never'`

Counter monotonically increases across years. Numbers grow forever:

- 2024: ...143
- 2025: ...144
- 2026: ...145

The template typically omits the year token in this case: `INV-{####}` → `INV-0145`.

## UI implications (Plan 5)

The issuer detail page has a *Numbering* section per doc type. Each row shows:

- Template input (with token autocomplete)
- Padding input (drives `{####}` width)
- Reset period radio (`yearly` / `never`)
- "Next number will be" preview (computed live as the user edits)
- Current counter (read-only display + a "danger zone" override button)

Changing the template after invoices have been issued is allowed. The previous numbers stay as they were (they're stored verbatim on the invoice rows). The new template applies to the *next* issuance only.

## Database

```sql
CREATE TABLE issuer_numbering_schemes (
  id              uuid PRIMARY KEY,
  workspace_id    uuid NOT NULL REFERENCES workspaces (id),
  issuer_id       uuid NOT NULL REFERENCES issuer_businesses (id),
  doc_type        text NOT NULL,    -- enum: invoice|proforma|advance|credit_note
  template        text NOT NULL,
  reset_period    text NOT NULL,    -- enum: yearly|never
  counter         integer NOT NULL DEFAULT 0,
  counter_year    integer,
  padding         integer NOT NULL DEFAULT 4,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer_id, doc_type)
);
```

The unique constraint guarantees one scheme per `(issuer, docType)`. Concurrency is handled per the atomicity rules above.

## Open numbering questions

### TODO(plan-2): monthly reset

`resetPeriod: 'monthly'` is plausible (`{YYMM}{####}` style). Not in MVP; if the schema accommodates it from day 1 (just add to the enum), we save a migration later. Decision lands during Plan 2.

### TODO(plan-7): renumber-from-N for imports

When importing historical invoices (CSV, ISDOC, …), we need to set the counter to the highest imported number and continue from there. UI surface lands during Plan 7's import work (which is itself post-MVP).

### TODO(plan-3): variable-symbol synthesis from `meta.number`

The Czech variable symbol (VS) is numeric only, max 10 digits. If the invoice number contains non-digits (e.g. `FV-2026-0007`), we synthesize VS by extracting digits left-to-right capped at 10, e.g. `202600070`. Tested via golden fixtures during Plan 3.
