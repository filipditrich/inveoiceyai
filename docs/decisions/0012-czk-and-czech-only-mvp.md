# 0012: CZK + Czech-only invoices in MVP

## Status

Superseded in part by [ADR 0026](0026-multi-currency-without-fx.md) for currency enum (language still Czech-only).

## Context

Czech businesses sometimes invoice abroad clients in EUR or USD. They sometimes issue bilingual (Czech + English) invoices for foreign clients who don't read Czech.

Scope options:

1. **CZK only, Czech only** — simplest; covers the personal use case completely
2. **CZK + EUR/USD with CNB-rate conversion**, Czech only — fits cross-border invoicing, more schema/UX
3. **Multi-currency + bilingual rendering (CS/EN)** — full international toolkit

Forces:

- The personal use case (UC1) is exclusively CZK and Czech-language clients
- ARES is Czech-only; lookups for foreign businesses won't work either way
- Multi-currency adds: exchange-rate fetching (CNB), per-invoice rate snapshot, currency rounding rules, currency display per line
- Bilingual adds: i18n in `@react-pdf/renderer` template, language toggle in builder, dual labels on PDF
- Doing all three later is _additive_: `currency: z.literal('CZK')` becomes `currency: z.enum(['CZK', 'EUR', 'USD'])`; `language: z.literal('cs')` becomes `z.enum(['cs', 'en'])`. No semantic break.

## Decision

The MVP supports **CZK only** as currency and **Czech only** as the invoice language.

Specifically:

- `InvoiceMetaSchema.currency` is `z.literal('CZK')`
- `InvoiceMetaSchema.language` is `z.literal('cs')`
- All PDF / ISDOC text is hard-coded Czech (with a language flag prepared for ISDOC's `@languageID` attribute, set to `cs`)
- SPAYD QR uses `CC:CZK`
- The invoice builder hides currency / language pickers (they're effectively constants)

Multi-currency and bilingual rendering land **post-MVP** as additive features. The schema literal types become enums; existing rows are unaffected; the PDF template grows i18n-aware sections.

## Consequences

### Positive

- Zero complexity for currency conversion in MVP
- One PDF template, one language — faster to design and test
- ISDOC mapping is unambiguous
- The personal use case is fully covered

### Negative

- A user who needs to invoice an EU client in EUR cannot do it in MVP; they'd issue an invoice in CZK using a manually-applied rate (acceptable workaround)
- Customers who deploy this for international use must wait for the post-MVP multi-currency work
- We accumulate a TODO marker on every place where currency / language is hard-coded; the marker is what enables the post-MVP fan-out without a hunt

### Neutral

- We pick the Czech-diacritic font in Plan 3 — it must support Latin Extended-A regardless, so this decision doesn't change font selection

## Plans touched

- Plan 2 (`invoice-core`) — schema literal types
- Plan 3 (PDF / ISDOC) — Czech-only labels
- Future post-MVP plan — multi-currency + bilingual

## References

- [`PRD.md`](../PRD.md) — out-of-scope table
- [`vat-czech.md`](../domain/vat-czech.md) — cross-border B2B note (currency caveat)
