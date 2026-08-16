# 0032: Inbound email capture through Resend Inbound aliases

## Status

Accepted

## Context

The value of an incoming-invoice feature collapses if a person has to save an
attachment and upload it. Capture has to reach the mailbox.

Invoicey runs on Vercel with no long-lived worker. Three families of solution
were on the table:

1. **A hosted inbound-parse provider** that receives mail on our domain and calls
   a webhook.
2. **A mailbox connector** (Gmail / Microsoft OAuth) that reads the user's own
   mailbox on a schedule.
3. **Self-hosted MX** — not seriously considered.

Two hard constraints shaped the choice. Serverless function request bodies are
small (single-digit MB), and invoice attachments are routinely larger — so any
design that pushes raw MIME into the webhook body fails on real mail. And every
additional vendor is another set of credentials, another failure mode, and
another thing to explain in the privacy policy.

Resend is already the transactional mail provider, `invoicey.ditrich.me` is
already verified, and `apps/web/app/api/webhooks/resend/route.ts` already
verifies Svix-signed Resend webhooks. Resend Inbound delivers a **metadata-only**
`email.received` webhook — body and attachments are pulled afterwards over the
API — which is precisely the shape a serverless host needs.

## Decision

- **Resend Inbound is the capture mechanism for v1.** MX records go on a
  dedicated subdomain (`inbox.invoicey.ditrich.me`) at the lowest priority value,
  so apex-domain mail is untouched.
- **Each workspace gets an unguessable alias**, `in-<random>@<inbound domain>`,
  not a slug. The address is a bearer capability: anyone who knows it can put a
  document into that workspace's inbox. A random local part makes enumeration
  and drive-by spam impractical, and the alias is rotatable from settings.
  Optional additional aliases route to a specific issuer for multi-entity
  workspaces.
- **The webhook stores metadata and enqueues; it does not parse.** The route
  verifies the Svix signature with a dedicated secret, resolves the alias to a
  workspace, writes an idempotent `inbox_items` row keyed on the provider email
  id, and returns `200` quickly. Body and attachment retrieval, hashing,
  storage, classification, and extraction run in the follow-up job.
- **Attachments are fetched by URL and re-stored in UploadThing** through the
  server-side API, so the archive is ours and does not depend on provider
  retention or on download URLs that expire.
- **Sender authentication results are recorded, not enforced.** SPF / DKIM /
  DMARC verdicts are persisted on the inbox item and surfaced in the UI. Hard
  rejection is wrong here: legitimate supplier invoices arrive forwarded, from
  misconfigured senders, and through mailing lists. An unauthenticated sender is
  a reason to look harder, not to lose the document.
- **Forwarded mail is expected, not an edge case.** The envelope sender will
  usually be the user, and the real supplier is inside the body. Both are stored;
  the parsed original sender is a display and classification hint only, never a
  trust signal.
- **Abuse limits are per workspace**: a cap on messages per day, attachments per
  message, and bytes per attachment, all enforced before storage. Over-limit
  messages are recorded as rejected inbox items so the user can see what
  happened rather than losing mail silently.
- **Mailbox connectors are deferred, not rejected.** If alias forwarding proves
  to be too much friction in practice, a Gmail/Microsoft connector becomes a
  second `CaptureAdapter` behind the same `inbox_items` contract. Nothing
  downstream of `inbox_items` may know how a document arrived.

## Consequences

- Capture requires DNS work and Resend Inbound enabled on the account — an
  operator step, not a code step, and a genuine launch dependency.
- The alias is a secret in the weak sense. It is displayed in settings with a
  copy affordance, a warning, and a rotate action; a rotated alias stops
  accepting mail immediately.
- Resend becomes a processor for inbound content as well as outbound. The
  privacy policy and any DPA need updating before this is enabled in production.
- Webhook delivery is at-least-once. Every stage — inbox item creation, document
  storage, extraction — has to be idempotent on `(workspace_id, provider email
id)` and on document `sha256`.
- Alias-based routing gives entity resolution for free in the multi-entity case:
  the address the mail arrived at can pin the issuer before anything is parsed.
- We do not get read access to the user's real mailbox, so nothing arrives that
  the user did not forward or redirect. That is a product limitation to state
  plainly in onboarding.

## Plans touched

- Plan 24b — inbound mail capture

## References

- [Inbound email capture specification](../specs/inbound-email-capture.md)
- [Incoming invoices specification](../specs/incoming-invoices.md)
- [0022 — Resend + react-email for transactional mail](./0022-resend-and-react-email.md)
- [0010 — UploadThing for file uploads](./0010-uploadthing-for-files.md)
- [Resend — receiving emails](https://resend.com/docs/dashboard/receiving/introduction)
