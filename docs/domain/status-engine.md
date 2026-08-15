# Status engine

How Invoicey decides whether an invoice is `draft`, `issued`, `paid`, `overdue`, or `cancelled`.

The core principle: **status is derived, not stored** (per [ADR 0014](../decisions/0014-status-derived-not-stored.md)). Issuance and cancellation are invoice facts; payment is authoritative in active `invoice_payment_allocations`. `paid_amount`, `payment_state`, and `paid_at` are transactionally maintained projections.

## States

| State       | Czech         | Description                                                                                |
| ----------- | ------------- | ------------------------------------------------------------------------------------------ |
| `draft`     | rozpracováno  | The invoice has been saved but not finalized. No number assigned. Editable.                |
| `issued`    | vystaveno     | Finalized — number assigned, snapshots frozen, due in the future, not yet paid. Read-only. |
| `overdue`   | po splatnosti | Issued, due date has passed, still unpaid.                                                 |
| `paid`      | uhrazeno      | Payment received and recorded.                                                             |
| `cancelled` | stornováno    | Issued and then explicitly cancelled by the issuer. Number stays consumed.                 |

## Persisted facts

Only these fields drive status. They live on the `invoices` row:

```ts
interface InvoiceFacts {
  issuedAt: Date | null; // null = draft
  dueDate: Date; // always present (default = issuedAt + payment terms)
  paidAt: Date | null; // compatibility projection: null until fully paid
  paidAmount: Decimal; // sum of active allocations
  paymentState: "unpaid" | "partial" | "paid" | "overpaid";
  cancelledAt: Date | null; // null = not cancelled
}
```

The number (`meta.number`) is also assigned at issue time — but the status logic only needs `issuedAt`. They're updated together in the same transaction (see [`numbering.md`](./numbering.md)).

## Derivation function (`deriveStatus`)

Implemented in `packages/invoice-core/src/status.ts` (Plan 2). Pure, takes facts + a "now" timestamp:

```ts
type InvoiceStatus = "draft" | "issued" | "overdue" | "paid" | "cancelled";

function deriveStatus(facts: InvoiceFacts, now: Date): InvoiceStatus {
  if (facts.cancelledAt !== null) return "cancelled";
  if (facts.issuedAt === null) return "draft";
  if (facts.paidAt !== null) return "paid";

  // issued, not paid, not cancelled → check due date
  const dueEndOfDay = endOfDayUTC(facts.dueDate);
  if (now > dueEndOfDay) return "overdue";
  return "issued";
}
```

`now` is injected so tests are deterministic and so the same invoice can render with consistent status across an entire request (we pass `request_started_at`).

## State diagram

```mermaid
stateDiagram-v2
    [*] --> draft: createInvoice()
    draft --> issued: issueInvoice()
    issued --> overdue: time passes due_date
    overdue --> issued: dueDate edited later (rare)
    issued --> paid: markPaid()
    overdue --> paid: markPaid()
    issued --> cancelled: cancelInvoice()
    overdue --> cancelled: cancelInvoice()
    paid --> [*]
    cancelled --> [*]
    draft --> [*]: deleteDraft()

    note right of draft
        editable, no number,
        no snapshots
    end note
    note right of cancelled
        immutable, number consumed
    end note
```

Note: reversing an allocation recomputes the projections. The compatibility `unmarkPaid` verb reverses all active allocations instead of deleting history.

## Allowed transitions per UI action

| Action             | Pre-state(s)          | Post-state                         | What changes                                           |
| ------------------ | --------------------- | ---------------------------------- | ------------------------------------------------------ |
| `saveDraft`        | (none, new) / `draft` | `draft`                            | persists payload                                       |
| `issueInvoice`     | `draft`               | `issued`                           | sets `issuedAt`, allocates number, freezes snapshots   |
| `markPaid(date?)`  | `issued`, `overdue`   | `paid`                             | creates a manual allocation for the outstanding amount |
| `unmarkPaid`       | `paid`                | `issued` or `overdue` (re-derived) | reverses active allocations and recomputes `paidAt`    |
| `cancelInvoice`    | `issued`, `overdue`   | `cancelled`                        | sets `cancelledAt`                                     |
| `deleteDraft`      | `draft`               | (deleted)                          | removes row entirely                                   |
| `editInvoice`      | `draft` only          | `draft`                            | updates payload, does not touch facts                  |
| `duplicateInvoice` | any                   | new `draft`                        | copies payload, drops snapshots/facts                  |

`issued` and `overdue` are not separate persisted states; they're derivations of the same persisted fact set. So "Mark paid" works identically against `issued` and `overdue`.

## What "issuing" actually does

`issueInvoice` is the only multi-step transition. It runs in one DB transaction (see [`numbering.md`](./numbering.md) for the full SQL):

1. Validate the draft payload via `InvoiceSchema.parse`
2. Lock the issuer's numbering scheme row (`SELECT … FOR UPDATE`)
3. Compute the next number via `nextInvoiceNumber(scheme, issueDate)`
4. Update the scheme counter (and possibly `counterYear` on a yearly reset)
5. Snapshot the issuer + client into JSON columns (see [`snapshots.md`](./snapshots.md))
6. Compute totals via `calcTotals(items, vat)`; verify they match the input
7. Insert (or update) the invoice row with `issuedAt = now`, `number = $resolved`, `payload_json = $validated`
8. Commit

If any step fails, the transaction rolls back. The counter does not advance. Snapshots are not partially written. The user sees an error.

## Immutability after issue

Once `issuedAt` is set, the invoice payload is **frozen**. UI does not present an "Edit" affordance for non-draft invoices.

Edge cases that require change after issue:

- **Wrong amount / wrong client**: cancel and re-issue (cancellation is the legitimate path)
- **Date typo**: same — cancel and re-issue
- **Forgot to add a line**: cancel and re-issue, OR issue a credit note + a new invoice (Czech accounting practice)

We do **not** support an "edit issued invoice" affordance. It would silently desync from PDFs already sent to clients, ISDOCs already imported into accounting tools, payments already in flight. Cancel-and-reissue is the only honest path.

### TODO(plan-9): cancellation UX

When you cancel, do we automatically open a fresh `duplicateInvoice` so the user can correct the mistake? Or just leave them on the canceled invoice with a "create corrected version" CTA? Default plan: explicit CTA, not automatic.

## Overdue: timezone & "due date" semantics

The due date is stored as a calendar date (not a timestamp). An invoice with `dueDate = 2026-05-17` becomes overdue at the _end_ of that day in **Europe/Prague** time:

```ts
function endOfDayUTC(d: Date): Date {
  // Treat d as a Europe/Prague calendar date; return its UTC end (next-day 00:00 Prague - 1ms)
  // (uses date-fns-tz or equivalent — final lib pick during Plan 2)
}
```

This avoids "your invoice became overdue at 2:00 a.m. while you slept" on shaky timezone handling.

## Display status (UI / filters)

Domain `deriveStatus` stays as above. The web UI and MCP summaries also expose a **display** bucket via `resolveDisplayStatus` in `@invoicey/invoice-core/status-display`:

| Display     | Czech         | Rule                                               |
| ----------- | ------------- | -------------------------------------------------- |
| `draft`     | Návrh         | `issuedAt == null`                                 |
| `paid`      | Zaplaceno     | `paidAt != null`                                   |
| `future`    | Budoucí       | unpaid ∧ `issueDate > today` (Prague calendar)     |
| `overdue`   | Po splatnosti | unpaid ∧ `issueDate <= today` ∧ `dueDate < today`  |
| `unpaid`    | Nezaplaceno   | unpaid ∧ `issueDate <= today` ∧ `dueDate >= today` |
| `cancelled` | Stornováno    | `cancelledAt != null`                              |

Priority: cancelled → draft → paid → **future** → overdue → unpaid. Domain still returns `issued` for both `future` and `unpaid`. List/dashboard filters use `displayStatusWhere`; URL keys are display names (`unpaid`, not `issued`). Legacy `?status=issued` maps to `unpaid`.

The former dashboard-only “upcoming ≤ 14 days” overlay was removed in favor of FO-style Future / Unpaid / Overdue cards.

## Why derive instead of store

If status were a stored column:

- Every dawn, _every_ invoice would need a job to check "did this become overdue overnight?"
- A clock-skew bug between the cron and the request handler would create inconsistencies users could see
- Queries that filter by status would still need to recompute it for correctness

Instead, status is computed:

- At read time in RSC pages (server-side, with `now = request_started_at`)
- Inside SQL for filterable queries — see below

We never need a cron just to "tick" status forward.

## Filtering by status in SQL

Pure derivation in TypeScript is great for individual rows, but the invoice list (Plan 7) needs to filter by status across thousands of rows efficiently. We map the derivation into SQL:

```sql
-- "WHERE status = 'overdue'" becomes:
WHERE cancelled_at IS NULL
  AND issued_at IS NOT NULL
  AND paid_at IS NULL
  AND due_date < (now() AT TIME ZONE 'Europe/Prague')::date

-- "WHERE status = 'issued'" becomes:
WHERE cancelled_at IS NULL
  AND issued_at IS NOT NULL
  AND paid_at IS NULL
  AND due_date >= (now() AT TIME ZONE 'Europe/Prague')::date

-- etc.
```

Centralized in `apps/web/lib/invoice-status-sql.ts` as `statusWhere` (domain) and `displayStatusWhere` (FO filter keys).

### Index strategy (Plan 7)

The query above uses `cancelled_at`, `issued_at`, `paid_at`, `due_date`. A partial index for the "live" set helps:

```sql
CREATE INDEX idx_invoices_active
  ON invoices (workspace_id, due_date, paid_at, issued_at)
  WHERE cancelled_at IS NULL;
```

Tuned during Plan 7 if real query plans demand more.

## Open status questions

### Allocation-derived payment state (Plan 22)

Czech practice allows partial payment (the client pays half and the rest stays outstanding). Plan 22 replaces the binary source with confirmed payment allocations and adds
`unpaid`, `partial`, `paid`, and `overpaid` payment state while maintaining
`paidAt` as a compatibility projection. The combined presentation is specified in
[`payment-ledger-fio.md`](../specs/payment-ledger-fio.md).

### TODO(plan-9): grace period for "due"

Some businesses give a grace period (e.g. 3 days after `dueDate`) before something is considered "overdue" in the dashboard. Not in MVP — `dueDate` is the cutoff.

### Unmark paid

`unmarkPaid` reverses active allocations with **no grace window**. Implemented in `@invoicey/invoice-tools/ops` (`unmarkInvoicePaidById`) and web actions (single + bulk). Not exposed on MCP/Eve in this pass.
