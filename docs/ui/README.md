# UI / UX docs

Information architecture, page intents, and per-flow UX specs. Written **just-in-time** before the plan that consumes them lands (per the [`core_plus_lazy_specs`](../README.md#lifecycle-conventions) strategy).

## Status

Shipped: [`visual-system.md`](./visual-system.md) (dark-first product identity and
cross-surface visual contract), [`invoice-builder-flow.md`](./invoice-builder-flow.md)
(Plan 6), [`data-grid-ux.md`](./data-grid-ux.md) (Plan 7),
[`onboarding.md`](./onboarding.md) (first-issuer `/welcome` + sectioned issuer
edit), and [`brand-assets.md`](./brand-assets.md) (product identity and
provider-hosted brand surfaces). Remaining docs land with their plans.

## Expected UI docs (with the plan that authors them)

| Doc                           | Plan that creates it | Purpose                                                                                                         |
| ----------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `information-architecture.md` | Plan 1               | Sidebar nav, route map, page intents, where each entity is created/edited/deleted                               |
| `invoice-builder-flow.md`     | Plan 6               | Step-by-step UX for creating an invoice (issuer pick → client pick/create → items → VAT → preview → save/issue) |
| `data-grid-ux.md`             | Plan 7               | Filter/sort/search interactions, row-action menu, empty/loading states                                          |
| `dashboard-layout.md`         | Plan 8               | Cards, chart, recent invoices arrangement; issuer-filter behavior                                               |
| `onboarding.md`               | Plan 9               | First-run experience, "Create your first issuer" guided flow                                                    |
| `invoicey-drive.md`           | Plan 30              | Companion promo, `/drive/connect`, Settings Drive, Mac menu bar, first-run                                      |

## Format conventions

Every UI doc includes:

- **Intent** — one paragraph: what the user comes here to do
- **Layout** — wireframe in mermaid `graph` or markdown ASCII; component breakdown by file
- **Validation rules** — what gets blocked client-side vs. server-side
- **Empty / loading / error states** — explicit notes per state
- **Keyboard / accessibility** — focus order, shortcuts, ARIA roles where non-obvious
- **Open questions / TODOs** — `TODO(plan-N):` markers

UI specs may reference (and bias) the choice of ReUI / shadcn components but never invent UI primitives — those come from the libraries (per [ADR 0003](../decisions/0003-shadcn-plus-reui-registry.md)).
