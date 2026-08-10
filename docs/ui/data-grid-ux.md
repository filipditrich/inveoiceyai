# Invoice list UX

## Intent

Scan and act on invoices quickly: filter by status/parties, open PDF/ISDOC, mark paid, duplicate.

## Layout

Toolbar (New + filters) above a bordered table. Status as muted badges. Actions as compact button row.

## Empty / loading

Empty: CTA to `/invoices/new`. Errors via `?invalid=` query toast text at top.
