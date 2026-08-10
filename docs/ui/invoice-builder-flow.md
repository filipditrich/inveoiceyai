# Invoice builder flow

## Intent

Create or edit a draft invoice, preview the PDF, then either save as draft or issue (assign number, freeze snapshots).

## Layout

```
┌──────────────┬─────────────────────┐
│ Issuer/client│ Live PDF preview    │
│ Dates / VAT  │ (iframe blob)       │
│ Line items   │                     │
│ [Draft][Issue]                     │
└──────────────┴─────────────────────┘
```

- Route: `/invoices/new`, `/invoices/[id]/edit` (drafts only)
- Form: React Hook Form + `useFieldArray` for lines
- Preview: debounced `POST /api/demo/invoice-pdf` → blob URL iframe

## Validation

- Client: required picks + numeric lines; totals via `calcTotals`
- Server Issue: full `InvoiceSchema` after numbering + snapshot freeze
- Server Draft: same payload shape with provisional `meta.number = "DRAFT"`

## Empty / loading / error

- No issuers/clients → CTA links to create them
- Preview shows last valid PDF; validation errors listed under form
- Issue failures redirect with `?invalid=`

## References

- [ADR 0015](../decisions/0015-rhf-plus-zod-resolver-builder.md)
- [ADR 0008](../decisions/0008-snapshot-issuer-client-at-issue-time.md)
