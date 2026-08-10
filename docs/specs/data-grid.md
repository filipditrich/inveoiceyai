# Invoice data grid

## Goal

List invoices with filters, search, sort, pagination, and row actions (view, edit draft, PDF, ISDOC, duplicate, mark paid, delete draft).

## Implementation note (Plan 7)

MVP uses the shadcn `Table` + query-param filters with **SQL** `WHERE` / `LIMIT` / `OFFSET` (not an in-memory filter). A full ReUI Data Grid can replace the presentation layer later without changing the query helpers in `lib/invoice-status-sql.ts`.

## Columns

| Column | Source |
| --- | --- |
| Number | `invoices.number` or `DRAFT` |
| Issue date | `issue_date` |
| Due date | `due_date` |
| Client | `client_name` |
| Total | `total` + currency |
| Status | `deriveStatus(facts)` badge |
| Actions | menu / buttons |

## Filters / search

- Query params: `status`, `issuerId`, `clientId`, `q`, `from`, `to`, `page`
- Search `q` matches number, client_name, notes (ILIKE)
- Page size 50

## Row actions

- View → `/invoices/:id`
- Edit → `/invoices/:id/edit` (drafts only)
- PDF → `/api/invoices/:id/pdf`
- ISDOC → `/api/invoices/:id/isdoc`
- Duplicate → `duplicateInvoice`
- Mark paid → `markInvoicePaid` (issued, not cancelled)
- Delete → `deleteInvoice` (drafts only)

## References

- [`domain/status-engine.md`](../domain/status-engine.md)
