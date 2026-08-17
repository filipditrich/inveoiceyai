# Recurring invoice drafts (Plan 10)

## Goal

Save an issued (or draft) invoice as a named template, attach a monthly or quarterly schedule, and have a daily cron materialize **one reviewable draft** when due. The user issues and sends themselves. No auto-issue, no auto-email, no MCP/Slack tools in v1.

## Inputs / outputs

| Surface                                  | Input                                      | Output                                                        |
| ---------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| Web “Save as recurring”                  | Invoice id + name + cadence + day of month | `invoice_templates` + `recurring_schedules` row               |
| Web list `/invoices/recurring`           | Workspace                                  | Templates with schedule, next run, last draft                 |
| Pause / resume / skip / delete / run now | Schedule or template id                    | Updated schedule or new draft                                 |
| Cron `GET /api/cron/recurring-drafts`    | Bearer `CRON_SECRET`                       | Drafts for due schedules; JSON `{ created, skipped, errors }` |

## Approach

### Tables

- `invoice_templates` — workspace-scoped named payload (`payload_json` is Invoice-shaped). `payment_due_days` is `dueDate − issueDate` from the source. Unique `(workspace_id, name)`.
- `recurring_schedules` — 1:1 with a template in v1 (`template_id` unique). `cadence` is `weekly` \| `monthly` \| `quarterly` \| `yearly`. `day_of_month` is 1–31 (31 = last day of the month). `next_run_on` is a Prague calendar `YYYY-MM-DD`. `paused` is 0/1. `last_invoice_id` is a uuid without FK (avoids a cycle with invoices).
- `invoices.recurring_schedule_id` — nullable FK, `ON DELETE SET NULL`. Used for provenance and “open draft exists”.

Do **not** reuse MCP `presets` (`kind: invoice_template`).

### Materialize

Shared by cron and **Run now**. Does **not** use `persistDraftInvoice` (that upserts issuer rows).

1. Parse template `payload_json` with `InvoiceSchema`.
2. Load **live** issuer + client snapshots; fail closed if missing or unparsable.
3. `issueDate = duzp = today` (Europe/Prague). `dueDate = today + payment_due_days`.
4. `meta.number = "DRAFT"`. Recalc totals with `calcTotals(..., issuer.vatPayer)`.
5. Insert invoice + items; set `recurring_schedule_id`.
6. Cron path only: set `last_run_on`, `last_invoice_id`, and advance `next_run_on` at least one cadence step, then until `next_run_on > today` (single catch-up draft, no backfill pile).

**Run now** creates a draft and does **not** consume `next_run_on`.

### Skip / idempotency

Skip (count as skipped, not error) when:

- schedule is paused
- issuer or client is missing
- an **unissued, uncancelled** invoice already exists for this `recurring_schedule_id`

### Cadence

- Default `next_run_on` on create = next occurrence of `day_of_month` **≥ tomorrow** (never same-day surprise). Weekly uses tomorrow.
- After a cron run, add 7 days (weekly), 1 month (monthly), 3 months (quarterly), or 12 months (yearly). Day 31 clamps to the last calendar day of that month.

### Cron

Copy overdue-reminders: `Authorization: Bearer ${CRON_SECRET}` (503 if unset, 401 if wrong). Loop all `workspaces`, pass **explicit** `workspaceId` into ops. Schedule `20 5 * * *` in `apps/web/vercel.json` (same Hobby hour as the other crons, before overdue reminders).

### UI

- Sidebar Invoices → Recurring → `/invoices/recurring`
- Invoice detail: Save as recurring (`docType === "invoice"` only)
- List actions: pause/resume, skip next, run now, delete
- Drafts show a “from recurring” hint

No template line editor. Change lines by saving a new template from a newer invoice.

## Open questions / TODOs

- `TODO(plan-10-later):` auto-issue / auto-email opt-in
- `TODO(plan-10-later):` MCP / Eve tools

## References

- [ADR 0027](../decisions/0027-recurring-drafts-only.md)
- [ADR 0008](../decisions/0008-snapshot-issuer-client-at-issue-time.md) — freeze still happens at Issue
- Overdue cron: `apps/web/app/api/cron/overdue-reminders/route.ts`
