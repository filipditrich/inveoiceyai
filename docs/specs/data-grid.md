# Invoice data grid

## Goal

List invoices with filters, search, sort, pagination, and row actions (view, edit draft, PDF, ISDOC, duplicate, mark paid, delete draft).

## Implementation

Presentation uses **ReUI Data Grid** + **ReUI Filters** (`apps/web/components/reui/…`) via shared wrappers in `apps/web/components/data-grid/`. Invoice list stays **server-driven**: SQL `WHERE` / `ORDER BY` / `LIMIT` / `OFFSET` in [`lib/invoices/list-query.ts`](../../apps/web/lib/invoices/list-query.ts) + [`lib/invoice-status-sql.ts`](../../apps/web/lib/invoice-status-sql.ts). TanStack Table runs in **manual** mode; URL state is typed with **nuqs**.

Clients and issuers use the same Data Grid shell with **client-side** filter/sort/pagination (small workspace datasets).

## Columns

| Column     | Source                       |
| ---------- | ---------------------------- |
| Number     | `invoices.number` or `DRAFT` |
| Issue date | `issue_date`                 |
| Due date   | `due_date`                   |
| Client     | `client_name`                |
| Total      | `total` + currency           |
| Status     | `resolveDisplayStatus` badge |
| Actions    | menu / buttons               |

## Filters / search / sort / pagination

- Query params: `status`, `issuerId`, `clientId`, `q`, `from`, `to`, `page`, `pageSize`, `sort`
- Search `q` matches number, client_name, notes (ILIKE)
- Sort: `issueDate|dueDate|clientName|total|number`.`asc|desc` (legacy `date_asc` / `date_desc` still accepted)
- Default page size 50; allowed sizes 25 / 50 / 100
- Column visibility is client-local (not in the URL)

## Row actions

- View → `/invoices/:id`
- Edit → `/invoices/:id/edit` (drafts only)
- PDF → `/api/invoices/:id/pdf`
- ISDOC → `/api/invoices/:id/isdoc`
- Duplicate → `duplicateInvoice`
- Mark paid → `markInvoicePaid` (issued, not cancelled)
- Delete → `deleteInvoice` (drafts only)
- Bulk bar: issue / paid / unmark / cancel / delete drafts

## References

- [`domain/status-engine.md`](../domain/status-engine.md)
- [ReUI Data Grid](https://reui.io/components/data-grid)
- [ReUI Filters](https://reui.io/components/filters)
