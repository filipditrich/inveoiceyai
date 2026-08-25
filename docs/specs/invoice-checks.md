# Invoice checks

**Parent:** [payables lifecycle](./payables-lifecycle.md) ·
**Companion:** [accounting layer](./accounting-layer.md),
[workflow paths and automations](./incoming-approval-workflows.md)

The configurable safety net at G1. A **check** is a named test run against an
invoice; a **finding** is one instance of a check firing on one invoice. This
replaces the flat `exception codes` list from plan 24, which had no severity, no
configuration, and no way to resolve anything.

---

## 1. Anatomy

```
invoice_checks                       -- configuration, one row per check per workspace
  workspace_id, code, is_enabled,
  severity: 'info' | 'warning' | 'blocking',
  applies_when jsonb,                -- same condition grammar as automations
  params jsonb,
  updated_by_user_id, updated_at

invoice_findings                     -- instances
  id, workspace_id, incoming_invoice_id,
  check_code, severity_at_fire,
  facts jsonb,                       -- what the check saw, for the card copy
  line_ids uuid[],                   -- which lines, when line-scoped
  status: 'open' | 'acknowledged' | 'resolved' | 'stale',
  acknowledged_by_user_id, acknowledged_at, note,
  created_at
```

**Severity decides the gate:**

| Severity   | Effect at G1                                                      |
| ---------- | ----------------------------------------------------------------- |
| `info`     | Shown, no action needed                                           |
| `warning`  | Shown; must be acknowledged with one click before the gate passes |
| `blocking` | Shown; the gate cannot pass while it is open                      |

Acknowledging a warning is a recorded act with an optional note — "ano, tenhle
dodavatel letos zdražil" — which becomes evidence in the audit trail, not a
dismissed toast.

**`applies_when`** is the condition grammar from
[automations](./incoming-approval-workflows.md) §4.1: OR-of-ANDs over the same
facts. This is how "warn me about amount deviation only above 50 000 Kč" is
expressed:

```jsonc
{
  "code": "amount_deviation",
  "severity": "warning",
  "applies_when": {
    "version": 2,
    "any": [
      {
        "all": [
          { "fact": "currency", "op": "eq", "value": "CZK" },
          { "fact": "total", "op": "gt", "value": "50000" },
        ],
      },
    ],
  },
  "params": { "band": "p10_p90", "margin_pct": 25 },
}
```

Findings are **recomputed on every edit** at G1. A finding whose cause the
accountant fixed becomes `stale` and disappears from the card stack rather than
requiring a dismissal — the field being correct is the resolution.

---

## 2. Catalogue

### 2.1 Identity and duplication

| Code                  | Fires when                                                                              | Default    |
| --------------------- | --------------------------------------------------------------------------------------- | ---------- |
| `duplicate_invoice`   | Same issuer + supplier + normalized number already exists and is live                   | `blocking` |
| `duplicate_suspect`   | Same supplier, same VS **or** same total, within `params.window_days`, different number | `warning`  |
| `supersedes_rejected` | Identity matches a **rejected** predecessor — this is a correction                      | `info`     |
| `entity_unresolved`   | Customer IČO matches zero or several issuers                                            | `blocking` |
| `supplier_unknown`    | No IČO and no name match                                                                | `blocking` |

`supersedes_rejected` is an `info` finding rather than a problem: its card is the
entry point to the correction diff described in
[payables lifecycle](./payables-lifecycle.md) §5.3.

### 2.2 Supplier trust

| Code                    | Fires when                                                                             | Default    |
| ----------------------- | -------------------------------------------------------------------------------------- | ---------- |
| `new_supplier`          | No prior validated invoice from this supplier                                          | `warning`  |
| `unreliable_vat_payer`  | Supplier is flagged nespolehlivý plátce DPH                                            | `blocking` |
| `account_not_published` | Beneficiary account is not among the supplier's accounts published in the VAT register | `warning`  |
| `bank_account_changed`  | Beneficiary differs from the supplier's confirmed account                              | `blocking` |
| `unverified_sender`     | SPF / DKIM / DMARC failed on the carrying message                                      | `warning`  |

The last three together are the invoice-fraud defence, and the combination
matters more than any one of them: a mail that fails DMARC, from a known
supplier, carrying a new account number, is the standard supplier-impersonation
attack. When all three fire at once the card stack renders them as **one**
merged card titled _"Možný pokus o podvod"_ with all three facts, because three
separate yellow cards will be clicked through and one red merged card will not.

`unreliable_vat_payer` and `account_not_published` both read the MFČR VAT
register. Results are cached per IČO with a TTL, in the same shape as the
existing ARES lookups in `@invoicey/ares`. A register lookup that fails leaves an
`info` finding saying the check could not run — never a silent pass.

### 2.3 Deviation from the supplier's own history

All read `supplier_profiles` (§3) and all no-op when the profile has fewer than
`params.min_history` invoices, defaulting to 3.

| Code                      | Fires when                                                                      | Default   |
| ------------------------- | ------------------------------------------------------------------------------- | --------- |
| `amount_deviation`        | Total outside the trailing band by more than `params.margin_pct`                | `warning` |
| `currency_changed`        | Currency differs from the supplier's usual                                      | `warning` |
| `payment_terms_deviation` | `due_date - issue_date` differs from the usual terms by more than `params.days` | `info`    |
| `unit_price_increase`     | A recurring line's unit price rose by more than `params.margin_pct`             | `warning` |
| `unexpected_invoice`      | Supplier bills monthly and this is a second invoice in the same period          | `info`    |
| `accounting_deviation`    | Resolved dimensions differ from the supplier's learned values                   | `info`    |

`unit_price_increase` matches lines across invoices by normalized description
plus unit — a deliberately conservative match. A line it cannot pair is not a
finding.

### 2.4 Arithmetic and format

Carried over from plan 24, now with severities.

| Code                     | Default    |
| ------------------------ | ---------- |
| `vat_mismatch`           | `blocking` |
| `line_total_mismatch`    | `blocking` |
| `missing_required_field` | `blocking` |
| `due_before_issue`       | `warning`  |
| `invalid_iban`           | `blocking` |
| `invalid_ico`            | `warning`  |
| `currency_unsupported`   | `warning`  |
| `low_confidence`         | `warning`  |
| `missing_accounting`     | `blocking` |

`vat_mismatch` and `line_total_mismatch` tolerate one minor unit, as before.

---

## 3. Supplier profiles

One row per supplier, recomputed when an invoice reaches `validated` and on a
nightly job for time-based facts.

```
supplier_profiles
  workspace_id, supplier_id,
  invoice_count, first_invoice_at, last_invoice_at,
  total_p10, total_p50, total_p90, total_currency,
  usual_currency, usual_payment_terms_days,
  usual_bank_account_id,
  cadence: 'monthly' | 'quarterly' | 'irregular' | 'unknown',
  cadence_confidence numeric,
  learned_predkontace_id, learned_centre_id, learned_activity_id,
  learned_contract_id, learned_vat_classification_id,
  isdoc_ratio numeric,
  computed_at
```

The percentile band is computed over the trailing 12 validated invoices in the
supplier's usual currency. Credit notes are excluded. A supplier whose invoices
span currencies gets a band per currency or, failing that, none.

`learned_*` columns are the unanimity-gated values described in
[accounting layer](./accounting-layer.md) §3.1 — the same table serves both the
deviation checks and the prefill, which is why they share a spec boundary.

`isdoc_ratio` feeds the supplier list's **Požádat o ISDOC** prompt: suppliers
sending the most PDFs, ranked by how much manual entry they cost.

---

## 4. The card stack

Findings render above the invoice fields, ordered `blocking`, `warning`, `info`,
and within a severity by the catalogue order above.

```
┌ ⛔ Změna bankovního účtu ────────────────────────────────┐
│ Faktura uvádí CZ65 0800 0000 1920 0014 5399.            │
│ Dosud jsme tomuto dodavateli platili na …4321           │
│ (potvrzeno 12. 3. 2026, 14 faktur).                     │
│                     [ Zobrazit rozdíl ]  [ Vyřešit → ]  │
└──────────────────────────────────────────────────────────┘
```

Every card states **what we saw**, **what we expected**, and **what to do**.
`Vyřešit` scrolls to and focuses the field responsible. A `blocking` card cannot
be dismissed; it disappears when the underlying fact changes, or — for
`bank_account_changed` — when an admin confirms the new account, which is a
separate, permissioned act.

Findings appear in list views as a compact severity column (`⛔2 ⚠1`), and any
list can be filtered to "has blocking findings".

---

## 5. Settings

`/settings/checks` — one row per check, grouped by the catalogue's four sections:

- a toggle, a severity selector, and an **Upravit podmínky** link opening the
  same condition builder used by automations;
- a **Platí pro** summary in plain Czech when a condition is set — _"Jen nad
  50 000 Kč"_;
- a live **fired on _n_ of your last 100 invoices** count per check, so a
  workspace can tune a severity without guessing.

Changing a severity does not retroactively re-block invoices that already passed
G1. Findings record `severity_at_fire`.

---

## 6. Testing

| Area              | Coverage                                                                          |
| ----------------- | --------------------------------------------------------------------------------- |
| Every check       | One fixture that fires it and one that does not                                   |
| `applies_when`    | A check with a condition does not fire below the threshold                        |
| Severity gate     | `blocking` refuses G1; `warning` refuses until acknowledged; `info` never refuses |
| Staleness         | Fixing the field clears the finding without a dismissal                           |
| Merged fraud card | Three fraud signals produce one card, not three                                   |
| Profiles          | Band excludes credit notes; unanimity gate on learned values; `min_history` no-op |
| Register lookups  | Cache hit, cache miss, provider outage produces an `info` finding                 |
