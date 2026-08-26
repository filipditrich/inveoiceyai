# Specs

Per-feature implementation specs. Written **just-in-time** before the plan that consumes them lands.

## Status

**Plan 3 specs:** [`pdf-rendering.md`](./pdf-rendering.md), [`spayd-qr.md`](./spayd-qr.md), [`isdoc.md`](./isdoc.md).

**Shipped specs:** [`pdf-rendering.md`](./pdf-rendering.md), [`spayd-qr.md`](./spayd-qr.md), [`isdoc.md`](./isdoc.md), [`ares.md`](./ares.md), [`uploads.md`](./uploads.md), [`data-grid.md`](./data-grid.md), [`slack-bot.md`](./slack-bot.md), [`mcp.md`](./mcp.md), [`db-schema.md`](./db-schema.md), [`invoice-import.md`](./invoice-import.md), [`email.md`](./email.md), [`public-shell.md`](./public-shell.md), [`recurring.md`](./recurring.md), [`payment-ledger-fio.md`](./payment-ledger-fio.md) (Plan 22 — pilot pending), [`payment-ledger-moneta.md`](./payment-ledger-moneta.md) (Plan 23).

> **Incoming invoices / payables were removed from the product on 2026-08-26.**
> The feature needed a different shape from the rest of Invoicey — a five-gate
> lifecycle, multi-actor approval, and an accounting-system integration — and is
> being rebuilt inside the NFCtron ecosystem instead. Everything, including the
> Plan 25 design specs and the mPohoda API analysis, is preserved on the
> `feat/payables-lifecycle` branch (tag `archive/payables-lifecycle`).

**Planned specs:** [`production-ux-finish.md`](./production-ux-finish.md) is the active cross-feature production UX program.

Just-in-time convention: write the remaining specs before the plan that consumes them ([lifecycle](../README.md#lifecycle-conventions)).

## Expected specs (with the plan that authors them)

| Spec                       | Plan that creates it | Purpose                                                                                                                              |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pdf-rendering.md`         | Plan 3               | `@react-pdf/renderer` template structure, font selection, layout grid, asset embedding                                               |
| `spayd-qr.md`              | Plan 3               | SPAYD payload builder, QR encoding, rendering as PDF image                                                                           |
| `isdoc.md`                 | Plan 3               | ISDOC 6.0.2 element-by-element mapping from `InvoiceSchema`, validators, importer compat notes                                       |
| `ares.md`                  | Plan 4               | ARES REST v3 endpoint URL, response shape, Zod parser, caching policy, error handling, identifikovaná osoba edge case                |
| `mcp.md`                   | Plan 12a             | Local stdio MCP + Vercel `/api/mcp`, tools, presets, Cursor + go-live checklist                                                      |
| `db-schema.md`             | DB foundation        | Neon tables: workspaces, issuer_businesses, clients, invoices, presets                                                               |
| `uploads.md`               | Plan 5               | UploadThing endpoints (issuer logo / stamp / signature, workspace logo), allowed MIME types and sizes, replace-without-delete policy |
| `data-grid.md`             | Plan 7               | ReUI Data Grid columns, filter/sort/search wiring, virtualization, row actions                                                       |
| `email.md`                 | Plan 11              | react-email templates, EmailTransport adapters (Resend first), From/Reply-To, webhooks, invoice send                                 |
| `public-shell.md`          | Plan 17              | Public homepage, auth entry shell, essential legal routes, consent UX, and launch metadata                                           |
| `recurring.md`             | Plan 10              | Invoice templates, monthly/quarterly schedules, cron drafts (HITL)                                                                   |
| `payment-ledger-fio.md`    | Plan 22              | Provider-neutral allocations, deterministic matching, encrypted Fio connection, sync, reconciliation UI                              |
| `payment-ledger-moneta.md` | Plan 23              | MONETA VIP AISP read-only adapter on the same ledger                                                                                 |

## Spec format conventions

Every spec includes, at minimum:

- **Goal** — one paragraph: what this feature does
- **Inputs / outputs** — types or interfaces this spec is responsible for
- **Approach** — how the implementation will work, with diagrams as needed
- **Open questions / TODOs** — explicitly marked with `TODO(plan-N):` so they get answered before implementation completes
- **References** — external docs, ADRs, existing code

If a spec's feature is dropped, the spec moves to `_archived/` with a one-line preface: `Archived YYYY-MM-DD because <reason>.` It does not get deleted.
