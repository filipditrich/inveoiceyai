# 0045: Canonical host is `invoicey.app`

## Status

Accepted (Plan 32, 2026-09-02) — supersedes the production-host and From-domain
sentences in [0022](./0022-resend-and-react-email.md) and the CLI default host
in [0044](./0044-invoicey-cli-companion.md).

## Context

Production lived at `https://invoicey.ditrich.me`. The product now has its own
`.app` name. `NEXT_PUBLIC_APP_URL` already drives sitemap, robots, invites, and
most email links, but CLI defaults, PDF footer, email From fallbacks, Drive
pairing, and several consoles still pinned the old host.

The CLI uses `redirect: "manual"` ([ADR 0044](./0044-invoicey-cli-companion.md)).
A blanket 308 of the old hostname would break every saved `cli.json` and Cursor
MCP URL.

`.app` is on the HSTS preload list. The domain is registered at Vercel
(nameservers already `ns1`/`ns2.vercel-dns.com`).

## Decision

1. **Canonical origin** is `https://invoicey.app` (apex). `www.invoicey.app`
   redirects to the apex.
2. **Keep `invoicey.ditrich.me` attached** to `inveoiceyai-web` and keep
   serving `/api/mcp`, `/api/companion`, `/eve/v1/*`, and `/install` there
   until saved machine clients have moved.
3. **Email From** is `invoices@invoicey.app` / `noreply@invoicey.app` once
   Resend verifies the new domain. Reply-To stays the issuer or inviter.
4. **Sessions do not migrate.** Host-only cookies stay on the old host;
   operators sign in again on `invoicey.app`.
5. **Issued PDFs are not rewritten.** New issues link the footer to
   `https://invoicey.app/`. Historical artifacts keep whatever URL they
   were rendered with ([ADR 0021](./0021-immutable-imported-invoice-artifacts.md)).

## Consequences

- Google and GitHub OAuth redirect URIs must exist on the new origin **before**
  `BETTER_AUTH_URL` flips.
- Better Auth `trustedOrigins` includes both hosts during the overlap.
- Drive pairing allowlists both origins until Associated Domains ships on
  `invoicey.app`.
- Operator cutover steps that cannot be done from the repo live in
  `scripts/cutover-invoicey-app.sh`.

## Plans touched

- Plan 32 (standalone domain)

## References

- [`docs/specs/standalone-domain.md`](../specs/standalone-domain.md)
- [ADR 0022](./0022-resend-and-react-email.md), [0044](./0044-invoicey-cli-companion.md)
