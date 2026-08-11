# Invoice builder flow

## Intent

Create or edit a draft invoice, preview the PDF, then either save as draft or issue (assign number, freeze snapshots).

## Layout

```
┌──────────────┬─────────────────────┐
│ Issuer/client│ Frameless PDF       │
│ Dates / VAT  │ preview (iframe)    │
│ Line items   │                     │
│ [Draft][Issue]                     │
└──────────────┴─────────────────────┘
```

- Route: `/invoices/new`, `/invoices/[id]/edit` (drafts only)
- Form: React Hook Form + `useFieldArray` for lines
- Preview: debounced `POST /api/demo/invoice-pdf` → blob URL iframe via `InvoicePdfPreview` (`#toolbar=0`, no card chrome)

## Fields

- Every control has a short Czech description; line inputs have placeholders.
- **Měna** is read-only **CZK** (ADR 0012 MVP); there is no currency picker.
- Totals and line running totals use `formatMoney` (`cs-CZ`).

## Validation

- Client: field-level RHF errors (`aria-invalid` + message under field) + top alert listing first errors; focus first invalid on submit.
- Schema: required parties, ISO dates, due ≥ issue, ≥1 line with description.
- Server Issue: full `InvoiceSchema` after numbering + snapshot freeze
- Server Draft: same payload shape with provisional `meta.number = "DRAFT"`
- Preview Zod issues from the API are surfaced in the preview overlay.

## Empty / loading / error

- No issuers/clients → CTA links to create them
- Issue failures redirect with `?invalid=`

## Issue outside the builder

- Detail + list row: **Vystavit** on drafts (`issueSavedInvoice` → `issueInvoiceById`)
- List bulk: floating bottom bar includes **Vystavit** for selected drafts

## References

- [ADR 0015](../decisions/0015-rhf-plus-zod-resolver-builder.md)
- [ADR 0008](../decisions/0008-snapshot-issuer-client-at-issue-time.md)
- [ADR 0012](../decisions/0012-czk-and-czech-only-mvp.md)
