# Cash-out planning

**Parent:** [payables lifecycle](./payables-lifecycle.md) ·
**Companion:** [payables, payment runs, and Fio submission](./payables-payment-runs-fio.md)

The layer between "approved" and "in a payment run": when we intend to pay each
approved invoice, how that intention is changed, and what the person deciding
sees.

The plan-24 payable calendar buckets by **due date**, which answers "what is
late" but not "what are we paying on Monday". Intent has to be a stored decision,
not a derived one, because it gets changed and the change needs a reason and an
audit trail.

---

## 1. Planned payment date

Every invoice reaching `approved` gets `planned_payment_date`, defaulted from the
workspace policy and then owned by people.

```
incoming_invoices
  planned_payment_date date,
  planned_source: 'policy' | 'manual' | 'postponed',
  postponed_from date,
  postpone_reason text,
  postponed_by_user_id, postponed_at
```

| Policy            | Default planned date | For                                            |
| ----------------- | -------------------- | ---------------------------------------------- |
| `on_due_date`     | `due_date`           | NFCtron — hold cash to the last legitimate day |
| `days_before_due` | `due_date - n`       | workspaces avoiding weekend and holiday edges  |
| `asap`            | next pay day         | workspaces optimising supplier relationships   |

An invoice already overdue on approval is planned for the **next pay day**, not
a date in the past.

Policy is workspace-level with a **per-supplier override**, so a supplier on
"platíme hned" terms can differ from the house rule without anyone touching
individual invoices.

---

## 2. Pay days

```
payment_calendars
  workspace_id, issuer_id,
  weekdays smallint[],        -- 1 = Monday
  cutoff_time time,           -- local, Europe/Prague
  skip_bank_holidays boolean default true,
  horizon_days integer default 60
```

NFCtron: `weekdays = {1}`, cutoff 11:00.

A pay day that falls on a Czech bank holiday shifts to the previous business day
when `skip_bank_holidays` is on — earlier, never later, because a payment moved
later can breach a due date.

**The proposed run.** For each pay day the system proposes a run containing every
approved, eligible invoice whose `planned_payment_date` falls on or before the
**following** pay day. For a Monday cadence that is precisely "everything due
this week", which is the rule NFCtron already runs by hand.

The proposal is a suggestion, not a scheduled action. Nothing is ever submitted
to a bank without a person assembling and confirming the run.

---

## 3. Postponement

A real business act, so it is an action with a reason rather than a date edit.

**Odložit platbu** takes a new date, a reason from a short configurable list plus
free text, and records `postponed_from`. The row keeps a badge — `Odloženo z
17. 8.` — for the life of the invoice.

Postponing **past the due date** is allowed. It is marked distinctly (red badge,
`Po splatnosti` bucket) and the confirmation names the consequence: _"Faktura
bude zaplacena 5 dní po splatnosti."_ The system's job is to make a deliberate
late payment visible, not to prevent a decision the business is entitled to
make.

`Zrušit odklad` restores the policy default and clears the badge.

Bulk postponement from the calendar, over a selection, with one shared reason.

Every postponement writes `payment_audit_events` with `payable.postponed`.

---

## 4. The cash-out view

`/payables` — the planning screen, distinct from the invoice queue.

```
┌ Cash-out ─────────────────────  Issuer: NFCtron s.r.o.  CZK ─┐
│                                                               │
│  Zůstatek dnes        1 240 000                               │
│  Naplánováno 7 dní     −418 500        →   821 500            │
│  Naplánováno 30 dní  −1 190 000        →      50 000  ⚠       │
│                                                               │
│ ── Po splatnosti (2) ──────────────────────  −64 000  ────────│
│ ── Pondělí 25. 8. · navrhovaná dávka (7) ── −418 500 ─────────│
│      Alza a.s.        FV2026-118    12 400   splatnost 26. 8. │
│      …                                                        │
│      [ Vytvořit dávku ]                                       │
│ ── Pondělí 1. 9. (5) ───────────────────────  −295 000 ───────│
│ ── Později (11) ────────────────────────────  −412 500 ───────│
└───────────────────────────────────────────────────────────────┘
```

- Buckets are **pay days**, not calendar weeks — the unit the workspace actually
  operates in. Workspaces with no pay days configured fall back to the plan-24
  due-date buckets.
- The projected balance runs against live `bank_accounts` balances plus amounts
  already committed to open runs. A projection that goes negative is flagged on
  the bucket that causes it.
- Per row: supplier, number, amount, due date, planned date, findings count,
  `accounting_state`, and blockers.
- Filters: issuer, currency, supplier, tag, has-blockers, overdue-only.
- Selection acts: **Vytvořit dávku**, **Odložit**, **Přidat štítek**.

**No revenue forecasting.** The projection uses money that exists and money we
have committed. Modelling expected receivables is a different product and a
different quality of promise.

---

## 5. Blockers on the plan

An approved invoice can still be unpayable. Blockers are shown on the row with
their reason and never hidden by filtering:

| Blocker                | Meaning                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `not_exported`         | `require_export_before_payment` is on and G3 has not succeeded |
| `unconfirmed_account`  | Beneficiary account has never been confirmed                   |
| `currency_unsupported` | Not CZK or EUR                                                 |
| `on_hold`              | An active hold                                                 |
| `in_active_run`        | Already committed to a live run                                |
| `blocking_finding`     | A blocking finding was reopened after approval                 |

The bucket totals count blocked invoices separately — the projection must not
promise cash that cannot leave.

---

## 6. Dashboard tiles

Three tiles on the workspace dashboard, each linking into a filtered `/payables`:

| Tile                        | Content                                       |
| --------------------------- | --------------------------------------------- |
| **K zaplacení tento týden** | Count and total for the next pay day          |
| **Po splatnosti**           | Count, total, and the oldest invoice's age    |
| **Blokované platby**        | Count of approved-but-blocked, by top blocker |

---

## 7. Testing

| Area                | Coverage                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| Policy defaults     | Each policy; an already-overdue invoice plans to the next pay day        |
| Pay day arithmetic  | Bank holiday shifts earlier; cutoff time; empty calendar falls back      |
| Proposed run window | Monday cadence includes exactly through the following Monday             |
| Postponement        | Reason required; badge persists; past-due confirmation; bulk; undo       |
| Projection          | Committed runs deducted once; blocked invoices excluded from the promise |
| Timezone            | All bucketing in `Europe/Prague` across a DST boundary                   |
