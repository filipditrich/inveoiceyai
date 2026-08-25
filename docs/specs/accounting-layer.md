# Accounting layer

**Parent:** [payables lifecycle](./payables-lifecycle.md) ·
**ADR:** [0036](../decisions/0036-accounting-dimension-layer.md) ·
**Companion:** [Pohoda integration](./pohoda-integration.md)

The dimensions an accountant attaches to an incoming invoice at G1 so it can be
booked: what they are, where their values come from, how a header default and a
line override resolve, and what makes the gate refuse to pass.

---

## 1. Dimensions

Modelled on POHODA, because that is the first integration and because its
vocabulary is what Czech accountants already use. The model is provider-neutral:
each dimension is a codelist, and a provider adapter declares which of them it
consumes.

| Dimension          | CZ          | Pohoda XML                   | mPohoda API       | Scope         |
| ------------------ | ----------- | ---------------------------- | ----------------- | ------------- |
| Pre-accounting     | Předkontace | `inv:accounting` → `typ:ids` | **not supported** | header + line |
| Cost centre        | Středisko   | `inv:centre` → `typ:ids`     | `CentreId`        | header + line |
| Activity           | Činnost     | `inv:activity` → `typ:ids`   | `ActivityId`      | header + line |
| Contract / job     | Zakázka     | `inv:contract` → `typ:ids`   | `ContractNumber`  | header + line |
| VAT classification | Členění DPH | `inv:classificationVAT`      | **not supported** | header + line |

Two dates belong to the same layer, header-only:

| Field             | CZ               | Meaning                               |
| ----------------- | ---------------- | ------------------------------------- |
| `tax_date`        | DUZP             | Tax point. Drives the VAT period.     |
| `accounting_date` | Datum zaúčtování | Booking date. Defaults to `tax_date`. |

`tax_date` already exists on `incoming_invoices`; `accounting_date` is new and
defaults to `tax_date` unless the workspace overrides the rule.

> The two "not supported" cells are the reason ADR 0037 makes Pohoda XML the
> reference rail rather than the mPohoda REST API. A workspace that requires
> předkontace control cannot be served by the REST rail.

---

## 2. Codelists

```
accounting_codelists
  id, workspace_id, connection_id (nullable), kind, name, is_active

accounting_codelist_items
  id, workspace_id, codelist_id, code, name, note,
  external_id, is_active, sort_order,
  source: 'sync' | 'manual' | 'import',
  synced_at, archived_at
```

`kind` is one of `predkontace`, `centre`, `activity`, `contract`,
`vat_classification`. Unique on `(codelist_id, code)`.

**Values come from three places. In plan 25 only the last two are built** — sync
needs a live connection to the accounting system, which is deferred with the
mServer rail ([Pohoda integration](./pohoda-integration.md) §4).

1. **Synced** from the accounting system — the truthful source. _Deferred._
2. **Imported** from a CSV the accountant pastes or uploads. This is the working
   answer for every dimension in plan 25, and the only possible one for
   předkontace and členění DPH, which have no published list export anywhere.
   The lists are short and change rarely, so this is not a hardship.
3. **Entered by hand** in settings.

Synced items are read-only in Invoicey and carry `external_id`. An item that
disappears from a sync is **archived, never deleted** — invoices already
referencing it must keep rendering. The same archival rule applies to a CSV
re-import that drops a code.

Archived items do not appear in pickers but do appear, struck through with a
warning, on invoices that already use them.

---

## 3. Resolution

Every dimension resolves per line, through a fixed chain. The first non-null
wins.

```mermaid
flowchart LR
  L["1 · Řádek<br/>explicitní override"] --> H["2 · Hlavička<br/>hodnota faktury"]
  H --> A["3 · Automatizace<br/>prefill_accounting"]
  A --> S["4 · Dodavatel<br/>pinned nebo naučené"]
  S --> W["5 · Workspace<br/>výchozí dle typu dokladu"]
  W --> N["6 · prázdné"]
```

Levels 3–5 fill the **header** at G1 entry; levels 1–2 are what the accountant
sees and edits. The distinction matters for the UI: a prefilled header value is
shown with a small provenance marker (`z historie dodavatele`, `z pravidla
Marketing`) and is editable, so the accountant always knows why a field is
already populated.

**Line inheritance is visual, not copied.** A line with no override renders the
header value greyed with an "inherited" marker. Editing the header updates every
inheriting line at once. Overriding a line detaches only that line, and a
**Zrušit override** action reattaches it. Nothing is silently copied down, which
is what makes bulk edits safe.

### 3.1 Supplier defaults, learned

`supplier_profiles` (see [invoice checks](./invoice-checks.md) §3, where the same
table serves the deviation checks) carries a learned mode for each dimension: the
value used on the last _n_ validated invoices from that supplier, when it is
unanimous. Unanimity is the bar — a supplier booked to three different centres
learns nothing and prefills nothing.

An admin can **pin** a supplier default, which overrides learning and is marked
as pinned in the UI.

This is the single feature that removes most of Ivan's typing: the second invoice
from a supplier arrives with its předkontace, středisko and činnost already
filled, sourced from what he chose the first time.

---

## 4. Requirements and blocking

Per workspace, per document type, each dimension is `required`, `optional`, or
`hidden`.

```
accounting_requirements
  workspace_id, doc_type, dimension, requirement, default_item_id
```

`required` means G1 cannot pass while the resolved value is null on the header
or on any line. The `missing_accounting` finding names the exact lines.

Defaults when an integration is enabled:

| Dimension   | Default requirement |
| ----------- | ------------------- |
| Předkontace | `required`          |
| Členění DPH | `required`          |
| Středisko   | `optional`          |
| Činnost     | `optional`          |
| Zakázka     | `hidden`            |

With no integration enabled, every dimension defaults to `hidden` — a workspace
that does not book anywhere is never nagged about předkontace.

---

## 5. The editing surface

The **Zaúčtování** section at G1, below the invoice fields.

```
┌─ Zaúčtování ──────────────────────────────────────────────┐
│ Předkontace *   [ 5xx / 321 — Služby        ▾]  z historie │
│ Členění DPH *   [ PDzaklad21                ▾]  z historie │
│ Středisko       [ 200 — Marketing           ▾]  z pravidla │
│ Činnost         [ —                         ▾]             │
│ DUZP *          [ 2026-08-14 ]   Zaúčtování [ 2026-08-14 ] │
│                                                            │
│ ── Řádky ──────────────────────── [ Rozúčtovat po řádcích ]│
│   Reklamní kampaň Q3      120 000   200 ⟨zděděno⟩          │
│   Grafické práce           18 000   [210 — Design]  ✕      │
└────────────────────────────────────────────────────────────┘
```

- Collapsed by default when every line inherits — the common case is one set of
  values for the whole invoice, and the UI should reflect that.
- **Rozúčtovat po řádcích** expands the per-line table.
- Bulk-set a dimension across selected lines from the line table's header.
- Keyboard: `Tab` walks required-and-empty fields first.

**Splitting an amount across centres** without splitting the invoice into lines
is a common request and is explicitly **not** supported in v1: an ISDOC invoice
has lines, and a percentage split without lines has no correct representation in
Pohoda's per-line model. A one-line invoice that needs a 60/40 split is handled
by the accountant splitting the line, which we support.

---

## 6. Locking after export

Once `accounting_state = exported`, the accounting layer is read-only with a
banner naming the external document number. **Upravit a znovu odeslat** unlocks
it, requires a reason, re-exports under the same `extId`, and records both
actions in the audit trail.

Core invoice fields (amounts, dates, supplier) are already immutable after
approval; this extends the same treatment to the dimensions.

---

## 7. Testing

| Area              | Coverage                                                                            |
| ----------------- | ----------------------------------------------------------------------------------- |
| Resolution chain  | Each level wins over the next; null at every level yields empty                     |
| Inheritance       | Header edit propagates to inheriting lines only; override survives; detach/reattach |
| Learning          | Unanimous history prefills; mixed history does not; pinned beats learned            |
| Requirements      | `required` blocks G1 naming the offending lines; `hidden` never renders             |
| Codelist archival | Archived item still renders on historical invoices, absent from pickers             |
| Locking           | Export locks; unlock requires a reason and re-exports under the same `extId`        |
