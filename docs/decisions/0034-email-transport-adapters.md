# 0034: Provider-neutral email transport with Resend first

## Status

Accepted

## Context

Resend is the only transactional transport ([ADR 0022](./0022-resend-and-react-email.md))
and, until incoming invoices were removed on 2026-08-26, the only inbound
capture path.
That was the right MVP choice: Vercel-hosted, react-email templates, metadata-only
inbound webhooks that do not push invoice PDFs through a function body.

Resend will not be the long-term scale path. Cost, daily rate limits, US-centric
residency, and inbound attachment shape all point at a later swap — most likely
AWS SES, which already matches the store-then-fetch inbound shape Invoicey needs
and is the stack NFCtron uses.

0022 already said the migration replaces the transport adapter, not
`@invoicey/emails`. The code did not have that adapter. `sendTransactionalEmail`
constructed a Resend client; inbound ingest called `api.resend.com` directly;
delivery status mapping assumed Resend event names.

## Decision

- Introduce `EmailTransport` and `InboundCaptureAdapter` in
  `@invoicey/invoice-tools` (`src/email/`). Templates, From/Reply-To rules, the
  `email_messages` / `email_events` log, and everything downstream of
  `inbox_items` stay provider-neutral.
- Keep **Resend as the only implementation**. `EMAIL_PROVIDER` defaults to
  `resend`. An unknown value fails closed.
- `sendTransactionalEmail` writes the lifecycle row, then calls
  `transport.send()`. The row's `provider` column comes from the transport, not
  a hardcoded `"resend"`.
- Delivery webhooks verify the provider signature in the route, then parse into
  `NormalizedEmailDeliveryEvent` before `applyEmailDeliveryEvent`.
- Inbound webhooks verify the provider signature in the route, parse into
  `NormalizedInboundNotification`, then enqueue ingest. Ingest fetches body and
  attachments through `InboundCaptureAdapter.fetchReceivedEmail`.
- Do not add an SES (or Postmark / Mailgun) implementation in this change.
  Adding one later is a new adapter + `EMAIL_PROVIDER` value + DNS/webhook
  operator work.

## Consequences

- A later SES adapter implements the two interfaces and maps SNS / S3 payloads
  into the same normalized events. Webhook routes stay provider-specific
  because signing schemes differ (Svix vs SNS).
- Inbound replacements must keep the metadata-then-fetch shape. Providers that
  POST raw MIME or base64 attachments in the webhook body are not a drop-in on
  Vercel.
- Resend env vars (`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`,
  `RESEND_INBOUND_WEBHOOK_SECRET`) remain required while Resend is selected.
- 0022 and 0032 stay in force. This ADR adds the seam they assumed.

## Plans touched

- Plan 11 (email) — transport seam
- Plan 24b (inbound capture) — capture adapter seam

## References

- [`docs/specs/email.md`](../specs/email.md)
- the inbound capture spec (removed 2026-08-26)
- [0022 — Resend + react-email](./0022-resend-and-react-email.md)
