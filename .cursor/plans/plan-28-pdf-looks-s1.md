# Plan 28 — PDF looks S1 (workspace builder)

**Status:** done  
**ADR:** [0039](../../docs/decisions/0039-looks-are-data-react-pdf-interprets.md)  
**Spec:** [pdf-looks-builder.md](../../docs/specs/pdf-looks-builder.md)

## Goal

Workspace-origin looks in the database, Pro builder (structured + JSON + preview), picker can apply them.

## Order

1. `origin: workspace`, slug, catalog lookup, version bump — tests in `invoice-core`
2. `workspace_looks` table + SQL + repo
3. `loadWorkspaceLookContext` carries the catalog; issue / draft / default look use it
4. Settings list + editor; invoice and workspace pickers list latest workspace looks
5. Preview posts `lookSnapshot` for non-first-party looks

S2 is not this plan.
