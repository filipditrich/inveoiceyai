# Plan 11b — Invoice send UI

Maps to roadmap **Plan 11b**. Spec: [`docs/specs/email.md`](../../docs/specs/email.md).

## Goal

Send issued invoices from the web UI with customizable cover text, PDF (+ ISDOC) attachments, issuer email defaults, and a delivery timeline on the invoice detail page.

## Exit criteria

- [x] `sendInvoiceEmail` action + shared ops handler
- [x] Issuer `email_settings` + edit UI
- [x] Send dialog + detail timeline (with event history)
- [x] Tests for settings defaults + DATABASE_URL fail-closed
- [ ] Manual smoke against Resend + inbox (operator)

## Notes

- Depends on 11a end-to-end (webhook + `email_messages`).
