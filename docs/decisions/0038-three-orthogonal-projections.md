# 0038 — Review, payment, and accounting are three projections, not one status

**Status:** accepted · **Date:** 2026-08-24 ·
**Spec:** [payables lifecycle](../specs/payables-lifecycle.md) §3

## Context

Plan 24 already split review (`status`) from money (`payment_state`), following
ADR 0014's "status derived, not stored" reasoning on the issued side. Adding an
accounting system introduces a third axis that is genuinely independent: an
invoice can be approved and unexported, approved and exported and unpaid, or
paid and export-failed. All three are ordinary.

The pull toward one column is strong because lists want one badge.

## Decision

Three columns, each written by exactly one service:

| Projection         | Written by              |
| ------------------ | ----------------------- |
| `status`           | workflow service        |
| `payment_state`    | allocation service      |
| `accounting_state` | accounting sync service |

No list may render a single conflated badge. A row shows the three separately,
and only `accounting_state` is hidden — when the workspace has no integration and
it is `not_applicable`.

## Consequences

**Good.** No impossible states. A failing accounting integration cannot corrupt
the approval record or the payment ledger. Each service owns its writes, which
keeps the audit trail attributable.

**Bad.** Every list and filter carries three dimensions, and the UI has to make
three badges legible without noise. Copy has to distinguish "schváleno" from
"zaúčtováno" from "zaplaceno" consistently, in two languages.
