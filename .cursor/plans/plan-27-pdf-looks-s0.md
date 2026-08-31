# Plan 27 — PDF looks S0

**Status:** implemented  
**ADR:** [0039](../../docs/decisions/0039-looks-are-data-react-pdf-interprets.md)  
**Spec:** [pdf-looks.md](../../docs/specs/pdf-looks.md)

## Goal

Classic `1.0.0` as data, Minimal `1.0.0` as a second layout, full look snapshot at issue, picker, Free locked to Classic.

## Order

1. Look document schema, validator, Classic + Minimal catalog, `resolveLookDocument`, `canApplyLook` — tests in `invoice-core`
2. Block interpreter; `renderInvoicePdf` uses the resolved look
3. Invoice payload `look` / `appearance` / `lookSnapshot`; `customization` compat
4. Entitlement `looks.apply` + SQL backfill + plan seeds
5. Workspace default look columns; issue/snapshot/duplicate/entitlement gates
6. Builder + workspace picker UI (locked Minimal on Free)

S1/S2 are not this plan.
