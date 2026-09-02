# Email delivery (Plan 11)

## Goal

Transactional email for Invoicey: invoice delivery to clients (PDF + optional ISDOC), workspace invitations, overdue reminders, and payment-received notices. Shared `EmailTransport` in `@invoicey/invoice-tools` (`sendTransactionalEmail`) used by web, MCP, and Eve; templates from `@invoicey/emails`; durable delivery log and webhook-driven status tracking. Resend is the first transport (ADR 0034).

## Inputs / outputs

| Surface                        | Input                                               | Output                                  |
| ------------------------------ | --------------------------------------------------- | --------------------------------------- |
| Web send dialog                | Issued invoice id + to/cc/subject/cover/attachIsdoc | `email_messages` row + provider id      |
| MCP / Eve `send_invoice_email` | Same as ops                                         | JSON `{ messageId, status, to }`        |
| Better Auth invite             | Invitee email + org                                 | `workspace_invite` template send        |
| Cron (11d)                     | Overdue invoices + issuer settings                  | `overdue_reminder` sends                |
| Delivery webhook               | Provider-signed events (Resend/Svix today)          | `email_events` + updated message status |

## Templates (`@invoicey/emails`)

| Template id        | When                                         |
| ------------------ | -------------------------------------------- |
| `invoice_sent`     | Manual / MCP / Eve send of an issued invoice |
| `workspace_invite` | Better Auth organization invitation          |
| `new_sign_in`      | Soft trusted-device alert (Plan 16)          |
| `overdue_reminder` | Daily cron when due and unpaid (opt-in)      |
| `payment_received` | Optional on mark-paid                        |

Client-facing invoice templates (`invoice_sent`, `overdue_reminder`, `payment_received`) use `invoice.meta.language` (`cs` | `en`). System templates (`workspace_invite`, `new_sign_in`) use the current request UI locale, default `cs`. Preview: `bun --cwd packages/emails email:dev`.

**`workspace_invite` props:** `workspaceName`, `inviterName`, `inviteUrl`, `role` (member/admin), optional `expiresAtLabel` (human-readable Prague time). Copy explains access, expiry, and that the invitee must sign in with the invited email. Invitations expire after **48 hours** (`invitationExpiresIn` in Better Auth org config). Resend refreshes expiry and re-sends this template.

## From / Reply-To

- **Invoice From address:** `invoices@invoicey.app` (override via `EMAIL_FROM`).
- **System From address:** `noreply@invoicey.app` (override via `EMAIL_SYSTEM_FROM`) for `new_sign_in` and `workspace_invite`.
- **Invoice From display:** `"{Name} via Invoicey"` — issuer name or send-time override (transport appends `via Invoicey` when missing).
- **System From display:** as provided (no auto `via` append). Security alerts use plain `Invoicey`; invites pass `{inviterName} via Invoicey` at the call site.
- **Reply-To:** issuer `contactEmail` (invoice sends) or inviter email (invites).
- Never arbitrary From domains — only addresses on the verified `invoicey.app` domain.

## UI / MCP contracts

| Surface                        | Notes                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| Web send sheet                 | To/Cc/subject/cover/attachIsdoc; From preview from `EMAIL_FROM`; suppression warn on To     |
| Detail timeline                | `email_messages` + nested `email_events` history                                            |
| MCP / Eve `send_invoice_email` | `{ id, to?, cc?, coverText?, attachIsdoc?, subject? }` — pass `to` when client has no email |

## Attachments

- Invoice sends: **PDF always**; **ISDOC on by default**, toggleable per send / issuer `email_settings.attachIsdocByDefault`.
- Attachment names use `invoiceArtifactFileNames` (localized `{kind}_{number}`, optional issuer `filenameTemplate`).
- Prefer stored `pdf_url` / `isdoc_url`; otherwise render via `@invoicey/invoice-core`.

## Status machine

Primary delivery statuses: `queued` → `sent` → `delivered` | `delayed` | `bounced` | `failed` | `complained`.

`opened` / `clicked` are soft signals (`opened_at` / `clicked_at`); they never regress delivery status. Terminal delivery outcomes (`bounced`, `failed`, `complained`) win over `delivered`.

## Transport adapters (ADR 0034)

`@invoicey/invoice-tools/src/email/` owns the seam:

| Contract                | Role                                  | First impl                          |
| ----------------------- | ------------------------------------- | ----------------------------------- |
| `EmailTransport`        | Outbound send                         | `createResendEmailTransport`        |
| `InboundCaptureAdapter` | Fetch received body + attachment URLs | `createResendInboundCaptureAdapter` |

`EMAIL_PROVIDER` selects the impl (`resend` today). Templates, From/Reply-To, and `email_messages` stay provider-neutral. A later SES adapter implements the same two interfaces; webhook _routes_ stay provider-specific because signing schemes differ.

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
  filenameTemplate?: string;      // "{kind}_{number}" — downloads + attachments
  overdueRemindersEnabled?: boolean; // default false
  overdueReminderIntervalDays?: number; // default 7
  sendPaymentReceivedEmail?: boolean; // default false
}
```

Live issuer settings are used at send time (not frozen into the invoice snapshot).

## Suppression (11d)

Table `email_suppressions`: `(workspace_id, email)` + `reason` (`bounce` | `complaint`). Automated sends (reminders, payment-received) skip suppressed addresses. Manual invoice send still allowed (operator choice) but surfaces a warning when suppressed.

## Env

| Var                     | Purpose                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `EMAIL_PROVIDER`        | Transport selector (`resend` today; fail closed on unknown)        |
| `RESEND_API_KEY`        | Resend send API (optional in schema; send fails closed when unset) |
| `RESEND_WEBHOOK_SECRET` | Svix webhook secret (optional; webhook fails closed when unset)    |
| `EMAIL_FROM`            | Invoice From (`Invoicey <invoices@invoicey.app>`)                  |
| `EMAIL_SYSTEM_FROM`     | System From (`Invoicey <noreply@invoicey.app>`)                    |
| `CRON_SECRET`           | Bearer for `/api/cron/overdue-reminders` (11d)                     |

## Go-live checklist (operator)

1. Add and verify domain `invoicey.app` in Resend (DNS on Vercel for `invoicey.app`). Keep `invoicey.ditrich.me` verified during the cutover.
2. Set `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, and optionally `EMAIL_SYSTEM_FROM` on Vercel. `noreply@` needs no separate mailbox once the domain is verified.
3. Point Resend webhook to `https://invoicey.app/api/webhooks/resend` with the subscribed events (the old host still serves the same route).
4. Set `CRON_SECRET` and schedule daily hit to `/api/cron/overdue-reminders`.

## References

- [ADR 0022](../decisions/0022-resend-and-react-email.md)
- [ADR 0034](../decisions/0034-email-transport-adapters.md)
- Roadmap Plan 11a–11d
- Resend webhooks: https://resend.com/docs/webhooks/event-types
