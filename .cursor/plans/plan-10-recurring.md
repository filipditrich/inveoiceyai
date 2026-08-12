# Plan 10 — Recurring invoice drafts

Maps to roadmap **Plan 10**. Spec: [`docs/specs/recurring.md`](../../docs/specs/recurring.md). ADR: [0027](../../docs/decisions/0027-recurring-drafts-only.md).

## Goal

Templates + monthly/quarterly schedules that materialize reviewable drafts via a daily cron. Web-only HITL: the user issues and sends.

## Locked decisions

- Draft only — no auto-issue, no auto-email
- Cadence: monthly and quarterly; `dayOfMonth` 1–28
- Timezone: Europe/Prague calendar dates
- Live issuer/client snapshots at materialize; freeze at Issue
- Catch-up: one draft, then jump `next_run_on` to the future
- Skip if an open draft already exists for the schedule
- MCP / Eve out of v1

## Exit criteria

- [x] Spec + ADR 0027 + this plan + roadmap section
- [x] `invoice_templates` + `recurring_schedules` + `invoices.recurring_schedule_id`
- [x] Ops: create from invoice, pause/resume/skip/delete, run now, `runDueRecurringForWorkspace`
- [x] Cron `/api/cron/recurring-drafts` + `vercel.json` `0 6 * * *`
- [x] `/invoices/recurring` + save-from-invoice; cs/en
- [x] Vitest for next-run, materialize, skip rules; typecheck / lint / test
