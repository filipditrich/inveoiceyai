# Email delivery (Plan 11)

## Goal

Transactional email for Invoicey: invoice delivery to clients (PDF + optional ISDOC), workspace invitations, overdue reminders, and payment-received notices. Shared Resend transport in `@invoicey/invoice-tools/email` (`sendTransactionalEmail`) used by web, MCP, and Eve; templates from `@invoicey/emails`; durable delivery log and webhook-driven status tracking.

## Inputs / outputs

| Surface                        | Input                                               | Output                                  |
| ------------------------------ | --------------------------------------------------- | --------------------------------------- |
| Web send dialog                | Issued invoice id + to/cc/subject/cover/attachIsdoc | `email_messages` row + Resend id        |
| MCP / Eve `send_invoice_email` | Same as ops                                         | JSON `{ messageId, status, to }`        |
| Better Auth invite             | Invitee email + org                                 | `workspace_invite` template send        |
| Cron (11d)                     | Overdue invoices + issuer settings                  | `overdue_reminder` sends                |
| Resend webhook                 | Svix-signed events                                  | `email_events` + updated message status |

## Templates (`@invoicey/emails`)

| Template id        | When                                         |
| ------------------ | -------------------------------------------- |
| `invoice_sent`     | Manual / MCP / Eve send of an issued invoice |
| `workspace_invite` | Better Auth organization invitation          |
| `overdue_reminder` | Daily cron when due and unpaid (opt-in)      |
| `payment_received` | Optional on mark-paid                        |

Czech copy for MVP. Preview: `bun --cwd packages/emails email:dev`.

## From / Reply-To

- **From address:** always `invoices@mail.invoicey.ditrich.me` (override via `EMAIL_FROM`).
- **From display:** `"{Name} via Invoicey"` — issuer name, user name, or send-time override. Never arbitrary From addresses.
- **Reply-To:** issuer `contactEmail` (invoice sends) or inviter email (invites).

## UI / MCP contracts

| Surface                        | Notes                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| Web send sheet                 | To/Cc/subject/cover/attachIsdoc; From preview from `EMAIL_FROM`; suppression warn on To     |
| Detail timeline                | `email_messages` + nested `email_events` history                                            |
| MCP / Eve `send_invoice_email` | `{ id, to?, cc?, coverText?, attachIsdoc?, subject? }` — pass `to` when client has no email |

## Attachments

- Invoice sends: **PDF always**; **ISDOC on by default**, toggleable per send / issuer `email_settings.attachIsdocByDefault`.
- Prefer stored `pdf_url` / `isdoc_url`; otherwise render via `@invoicey/invoice-core`.

## Status machine

Primary delivery statuses: `queued` → `sent` → `delivered` | `delayed` | `bounced` | `failed` | `complained`.

`opened` / `clicked` are soft signals (`opened_at` / `clicked_at`); they never regress delivery status. Terminal delivery outcomes (`bounced`, `failed`, `complained`) win over `delivered`.

## Webhooks

- Route: `POST /api/webhooks/resend`
- Verify Svix signature with `RESEND_WEBHOOK_SECRET` (fail closed when unset).
- Dedupe on `provider_event_id` (Svix id).
- Subscribe: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.failed`, `email.complained`, `email.opened`, `email.clicked`.
- Tags on send: `workspace_id`, `message_id`, `template` (and `invoice_id` when present).

## Issuer `email_settings` (jsonb)

```ts
{
  defaultSubject?: string;       // "Faktura {number} — {issuerName}"
  defaultCoverText?: string;
  attachIsdocByDefault?: boolean; // default true
  displayNameTemplate?: string;   // "{issuerName} via Invoicey"
  overdueRemindersEnabled?: boolean; // default false
  overdueReminderIntervalDays?: number; // default 7
  sendPaymentReceivedEmail?: boolean; // default false
}
```

Live issuer settings are used at send time (not frozen into the invoice snapshot).

## Suppression (11d)

Table `email_suppressions`: `(workspace_id, email)` + `reason` (`bounce` | `complaint`). Automated sends (reminders, payment-received) skip suppressed addresses. Manual invoice send still allowed (operator choice) but surfaces a warning when suppressed.

## Env

| Var                     | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `RESEND_API_KEY`        | Send API (optional in schema; send fails closed when unset)     |
| `RESEND_WEBHOOK_SECRET` | Svix webhook secret (optional; webhook fails closed when unset) |
| `EMAIL_FROM`            | Default `Invoicey <invoices@mail.invoicey.ditrich.me>`          |
| `CRON_SECRET`           | Bearer for `/api/cron/overdue-reminders` (11d)                  |

## Go-live checklist (operator)

1. Add and verify domain `mail.invoicey.ditrich.me` in Resend (DNS on ditrich.me).
2. Set `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM` on Vercel.
3. Point Resend webhook to `https://invoicey.ditrich.me/api/webhooks/resend` with the subscribed events.
4. Set `CRON_SECRET` and schedule daily hit to `/api/cron/overdue-reminders`.

## References

- [ADR 0022](../decisions/0022-resend-and-react-email.md)
- Roadmap Plan 11a–11d
- Resend webhooks: https://resend.com/docs/webhooks/event-types
