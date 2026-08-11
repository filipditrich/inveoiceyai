# Plan 11a — Email engine

Maps to roadmap **Plan 11a**. Spec: [`docs/specs/email.md`](../../docs/specs/email.md). ADR: [`0022`](../../docs/decisions/0022-resend-and-react-email.md).

## Goal

Shared transactional send path: `@invoicey/emails` templates, Resend client, `email_messages` / `email_events`, webhook status updates, Better Auth invite send.

## Exit criteria

- [x] Spec + ADR + roadmap 11a section
- [x] `@invoicey/emails` with invoice-sent + workspace-invite (+ stub overdue / payment-received)
- [x] Drizzle tables + schema applied
- [x] Resend client + webhook route + env schema
- [x] Auth invite sends via Resend when key set
- [x] Vitest for render + from-display + webhook status mapping
- [ ] Manual: Resend test send + webhook → Neon row (operator)

## Notes

- Sync send only (no queue worker).
- Sending domain: `invoicey.ditrich.me`.
- Shared transport: `@invoicey/invoice-tools/email` `sendTransactionalEmail`.
