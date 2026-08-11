# Invoice list UX

## Intent

Scan and act on invoices quickly: filter by display status/parties, open PDF/ISDOC, mark/unmark paid, cancel, duplicate, bulk ops.

## Layout

1. Title + primary CTA (**+ Vystavit fakturu**)
2. **Status summary strip** — Paid / Draft / Unpaid / Overdue / Future / Cancelled with CZK totals + counts; click sets `?status=`
3. Filter toolbar (status, issuer, client, date range, search, sort)
4. Bulk bar when rows selected (mark paid / unmark / cancel / delete drafts)
5. Table with color-coded left accent + status pills + row actions

## Status presentation

Czech FO labels via `DISPLAY_STATUS_LABELS`. Colors: green paid, blue draft, orange unpaid, red overdue, purple future, muted cancelled. See `@invoicey/invoice-core/status-display` + `apps/web/lib/invoice-status-ui.ts`.

## Empty / loading

Empty: CTA to `/invoices/new`. Errors via `?invalid=`; bulk results via `?toast=bulk_*&ok=&skipped=&failed=`.
