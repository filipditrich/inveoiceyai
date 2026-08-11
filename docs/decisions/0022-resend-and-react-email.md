# 0022: Resend + react-email for transactional mail

## Status

Accepted (Plan 11, 2026-08-11)

## Context

Plan 11 needs invoice delivery to clients (PDF + ISDOC), delivery tracking, and a path for future transactional mail (workspace invites, overdue reminders). Architecture already named `RESEND_API_KEY`. NFCtron uses SES + a large `@nfctron/nfctron-emails` react-email package; Invoicey is Vercel-hosted and low volume.

Alternatives considered:

1. **AWS SES + nodemailer** — full control and configuration sets; more ops (IAM, SNS, reputation) than we need.
2. **Inline HTML strings in Next** — fast to ship one template; poor reuse, preview, and type safety.
3. **Resend-hosted templates only** — couples copy to the provider dashboard; harder to version in git.

## Decision

1. **Resend** is the only transactional transport for Plan 11.
2. **`@invoicey/emails`** holds react-email templates and `render*()` helpers (source-exported like `@invoicey/ares`).
3. **Send + webhook** live in `apps/web` (`lib/email/*`, `/api/webhooks/resend`); lifecycle rows in Neon (`email_messages`, `email_events`).
4. **From** is always our verified domain; only the display name is customized (`"{Name} via Invoicey"`). **Reply-To** carries the issuer/user address.

## Consequences

- Domain verification and DNS for `invoicey.ditrich.me` are operator prerequisites.
- Open/click rates are soft signals (pixel/link tracking); UI prioritizes sent/delivered/bounced.
- Better Auth `sendInvitationEmail` uses the same Resend client — no second mail stack.
- Migrating to SES later would replace the transport adapter, not the templates package.

## Plans touched

- Plan 11a–11d (email)

## References

- [`docs/specs/email.md`](../specs/email.md)
- [Resend](https://resend.com/docs)
- [react-email](https://react.email)
