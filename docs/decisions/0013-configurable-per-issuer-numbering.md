# 0013: Configurable numbering schemes per issuer (and per doc type)

## Status

Accepted (Phase 0, 2026-05-03)

## Context

Czech invoicing practice does not standardize invoice-number formats. Common patterns:

- `2026001`, `2026002`, … — year + 4-digit counter
- `26050007` — year + month + counter (for high-volume issuers)
- `FV-2026-007` — type prefix + year + counter
- `INV-2026-007` and `PF-2026-001` — separate streams per doc type
- `001/2026` — counter/year (slash separator; less common)

Each issuer business chooses its own. A single user with multiple issuer businesses (UC1) needs each issuer to have its own scheme.

Options:

1. **Hard-coded format** (`{YYYY}{####}`, no customization) — simple, fits 70 % of users, frustrates the rest
2. **Per-issuer global format** (one template per issuer regardless of doc type) — fits more users, but mixes invoice + proforma + credit-note in one counter, which most accountants dislike
3. **Per-issuer per-doc-type templates with token substitution** — fits everyone; one counter per (issuer, doc_type) pair
4. **Custom JS expressions for max flexibility** — over-engineered, security risk if the input is user-supplied

Forces:

- The personal use case has multiple issuer businesses with different conventions
- Czech accounting practice strongly prefers separate counter streams per doc type
- Yearly reset is the norm but not universal — some businesses run continuous counters
- Migrations from existing tools may need to "jump the counter" to a starting value

## Decision

Each issuer business has, per document type, a `NumberingScheme` row consisting of:

- `template` — a string with `{YYYY}` / `{YY}` / `{MM}` / `{DD}` / `{####}` / `{ISSUER}` / `{TYPE}` tokens
- `padding` — counter padding width (used to keep `{####}` consistent)
- `resetPeriod` — `'yearly'` or `'never'`
- `counter`, `counterYear` — current state

Resolution is a pure function (`nextInvoiceNumber`) that produces the next number from the scheme + the issue date. The transactional issue path increments the counter atomically (per [`numbering.md`](../domain/numbering.md)). See full spec there.

UX (Plan 5): the issuer detail page shows a Numbering section with one editor per doc type. Each editor offers token autocomplete, a live preview ("Next number: …"), and a reset-period radio.

## Consequences

### Positive

- Every Czech accounting style is reachable
- Per-doc-type counters keep streams clean
- Yearly reset is a one-radio toggle
- Token resolution is a small, testable pure function

### Negative

- The UX is more complex than a single-format world; mitigation is good defaults (`{YYYY}{####}`, padding 4, yearly reset)
- The unique constraint `(issuer_id, doc_type)` enforces single-scheme-per-pair; users who want exotic per-currency or per-client streams won't get that in MVP
- Users importing historical data may need to jump the counter; we expose a "danger zone" in the Plan 5 UI for this

### Neutral

- We do **not** support `{MM}`-driven monthly reset in MVP — `resetPeriod` enum is `yearly`/`never` only. Adding `monthly` later is enum-level and small; see TODO in `numbering.md`.

## Plans touched

- Plan 2 (`invoice-core`) — `nextInvoiceNumber` pure function
- Plan 5 (issuers UI) — the editor
- Plan 6 (builder) — preview the next number when an issuer is picked

## References

- [`numbering.md`](../domain/numbering.md) — full algorithm, atomicity, examples
