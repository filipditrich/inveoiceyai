# Invoice list UX

## Intent

Scan and act on invoices quickly: filter by display status/parties, open PDF/ISDOC, issue drafts, mark/unmark paid, cancel, duplicate, bulk ops.

## Layout

1. Title + primary CTA (**+ Vystavit fakturu**)
2. **Status summary strip** — Paid / Draft / Unpaid / Overdue / Future / Cancelled with CZK totals + counts; click sets `?status=`
3. **ReUI Filters** toolbar (search, status, issuer, client) + date range inputs; shareable via URL (nuqs)
4. **ReUI Data Grid** — sortable columns, column visibility, page size, dense sticky header, status pills, row actions (including **Vystavit** on drafts)
5. When rows are selected: **fixed bottom floating bar** with selection count, sum of selected totals (`formatMoney`), and actions — Vystavit / Zaplaceno / Zrušit zaplaceno / Stornovat / Smazat návrhy / Zrušit výběr

## Status presentation

Czech FO labels via `DISPLAY_STATUS_LABELS`. Colors: green paid, blue draft, orange unpaid, red overdue, purple future, muted cancelled. See `@invoicey/invoice-core/status-display` + `apps/web/lib/invoice-status-ui.ts`.

Dates and amounts on the list use `formatDateCs` / `formatMoney` (`cs-CZ`).

## Empty / loading

Empty: CTA to `/invoices/new`. Errors via `?invalid=`; bulk results via `?toast=bulk_*&ok=&skipped=&failed=`.
