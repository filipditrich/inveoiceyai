# Specs

Per-feature implementation specs. Written **just-in-time** before the plan that consumes them lands.

## Status (Phase 0)

This folder is intentionally empty as of Phase 0 — we adopted the [`core_plus_lazy_specs`](../README.md#lifecycle-conventions) doc-depth strategy: domain contracts and ADRs upfront, feature-level specs deferred until each plan starts.

## Expected specs (with the plan that authors them)

| Spec | Plan that creates it | Purpose |
| --- | --- | --- |
| `pdf-rendering.md` | Plan 3 | `@react-pdf/renderer` template structure, font selection, layout grid, asset embedding |
| `spayd-qr.md` | Plan 3 | SPAYD payload builder, QR encoding, rendering as PDF image |
| `isdoc.md` | Plan 3 | ISDOC 6.0.2 element-by-element mapping from `InvoiceSchema`, validators, importer compat notes |
| `ares.md` | Plan 4 | ARES REST v3 endpoint URL, response shape, Zod parser, caching policy, error handling, identifikovaná osoba edge case |
| `uploads.md` | Plan 5 | UploadThing endpoints (logo / stamp / signature), allowed MIME types and sizes, replace-without-delete policy |
| `data-grid.md` | Plan 7 | ReUI Data Grid columns, filter/sort/search wiring, virtualization, row actions |

## Spec format conventions

Every spec includes, at minimum:

- **Goal** — one paragraph: what this feature does
- **Inputs / outputs** — types or interfaces this spec is responsible for
- **Approach** — how the implementation will work, with diagrams as needed
- **Open questions / TODOs** — explicitly marked with `TODO(plan-N):` so they get answered before implementation completes
- **References** — external docs, ADRs, existing code

If a spec's feature is dropped, the spec moves to `_archived/` with a one-line preface: `Archived YYYY-MM-DD because <reason>.` It does not get deleted.
