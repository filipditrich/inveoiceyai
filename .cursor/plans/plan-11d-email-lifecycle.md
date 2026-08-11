# Plan 11d — Email lifecycle

Maps to roadmap **Plan 11d**. Spec: [`docs/specs/email.md`](../../docs/specs/email.md).

## Goal

Automated overdue reminders (cron, opt-in), optional payment-received notices, and bounce/complaint suppression for automated sends.

## Exit criteria

- [x] Cron `/api/cron/overdue-reminders` + `CRON_SECRET`
- [x] Payment-received hook on mark-paid (ops + bulk)
- [x] `email_suppressions` honored
- [x] Eligibility settings tests
- [ ] Manual cron smoke with CRON_SECRET (operator)

## Notes

- Manual invoice send may still target a suppressed address (with UI warning).
