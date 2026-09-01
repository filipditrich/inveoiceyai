# 0011: Full Czech VAT compliance from day one

## Status

Accepted (Phase 0, 2026-05-03)

## Context

Czech VAT has several modes (regular, reverse charge, OSS), several rates (21 / 12 / 0), supplies-abroad subtleties, and a separate "DUZP" date that's mandatory on tax invoices. The product's primary user (and the personal use case) explicitly needs all of these — a Czech IT freelancer routinely issues:

- Standard 21 % invoices to domestic VAT-payer clients
- Reverse-charge (přenesená daňová povinnost) invoices to construction-related clients
- Cross-border B2B EU services (reverse charge per Article 196 of the EU VAT Directive)
- Occasional 12 % accommodation/transport invoices

Options:

1. **Start with neplátce-only** (no VAT) → fast to ship, useless for the actual user
2. **Start with neplátce + simple regular VAT** (21 % only) → still misses construction reverse-charge and cross-border cases
3. **Full compliance (regular + reverse charge + OSS, all rates, DUZP)** → larger schema and UX surface, but matches the user's day-one needs
4. **Full compliance plus identifikovaná osoba edge case** → marginal complexity for a rare scenario

Forces:

- The schema choices made now propagate everywhere (PDF rendering, ISDOC mapping, future MCP/Slack)
- Adding `vat.mode` and `vat.suppliesAbroad` later means schema migration and back-filling defaults
- The MVP needs to be _useful for the personal use case_ — not a toy

## Decision

The MVP supports **the full set of common Czech VAT scenarios** at the schema and rendering level:

- Rates 21 %, 12 %, 0 % (with custom positive integer rates allowed for backdated invoices — see [`vat-czech.md`](../domain/vat-czech.md))
- Modes `regular`, `reverse_charge`, `oss`
- `suppliesAbroad` flag with `none` / `eu` / `non_eu`
- DUZP as a first-class field on `meta`
- `vatPayer` flag on each issuer driving "is a tax document" semantics
- Default Czech legal-note text per mode (editable by the issuer)

UX coverage:

- The invoice builder exposes `regular` and `reverse_charge` directly; `oss` is behind an "Advanced" toggle (rare scenario)
- The default mode for a new invoice is `regular` with `suppliesAbroad: 'none'`
- Cross-field validation enforces consistency (per the rules in [`vat-czech.md`](../domain/vat-czech.md))

Identifikovaná osoba is **not** modeled with a dedicated flag in MVP — it's reachable as `vatPayer = false` plus a `dic` value. Re-evaluated in Plan 9 (polish).

## Consequences

### Positive

- The user can issue every invoice they realistically need from day one
- The schema doesn't need a migration to support reverse-charge or OSS later
- ISDOC export handles complex cases out of the gate (tax-authority importers expect them)
- The MVP is a credible product, not a toy

### Negative

- The builder UX has more knobs (mode + supplies-abroad + per-line rates). Mitigated by sensible defaults and a tight, focused form.
- Cross-field validation is non-trivial; mistakes in the rules become real-world tax errors. Mitigated by extensive unit tests in Plan 2 (one fixture per scenario in `vat-czech.md`).
- We commit to keeping VAT rules current — the 2024 consolidation reform (3 → 2 rates) already happened; the next reform is unknown but possible.

### Neutral

- We do **not** model:
  - Margin-scheme VAT for second-hand goods (special regime)
  - Travel-services special scheme
  - Cash-basis VAT registration
    These are out of scope; users in those regimes need a different tool.

## Plans touched

- Plan 2 (`invoice-core`) — VAT logic in `calcTotals`
- Plan 3 (PDF / ISDOC) — per-mode rendering and tagging
- Plan 6 (builder) — UX for the modes
- Plan 9 (polish) — re-evaluate identifikovaná osoba

## References

- [`vat-czech.md`](../domain/vat-czech.md) — full rules + worked examples
- Zákon č. 235/2004 Sb. (Czech VAT Act)
- Council Directive 2006/112/EC
