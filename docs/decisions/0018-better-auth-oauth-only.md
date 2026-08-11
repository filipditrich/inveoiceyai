# 0018: Better Auth, OAuth-only (no Clerk, no passwords)

## Status

Accepted (Plan 14, 2026-08-11) — supersedes the Clerk-oriented path in [0006](./0006-no-auth-mvp-multi-tenant-ready.md) for authentication provider choice.

## Context

ADR 0006 deferred auth and assumed Clerk could land later via Vercel Marketplace. By Plan 14 we needed real multi-user sessions, workspace membership, invitations, and a path to personal API keys for MCP/Eve — without taking on Clerk’s hosted UI, pricing, and org model that would fight our existing `workspaces` table.

Alternatives considered:

1. **Clerk** — fast Marketplace install; org model and machine auth diverge from Neon `workspaces` + env ops keys already in production.
2. **Auth.js / NextAuth** — flexible but weaker first-party org/API-key plugins for our stack.
3. **Better Auth** — TypeScript-native, Drizzle adapter, `organization` + `apiKey` + MCP OIDC plugins, runs in our Next app on Neon.

Forces:

- Invoicey is OAuth-only for humans (Google/GitHub); no email/password or TOTP in v1.
- Business data already keys on `workspace_id` (ADR 0007); auth must not invent a second tenancy id.
- Machine callers (remote MCP, Eve HTTP) already use bearer env keys; user PATs should layer on later without a second IdP.

## Decision

1. **Provider:** Better Auth in `apps/web` (`lib/auth/auth.ts`), Drizzle + Neon, `nextCookies` last in the plugin list.
2. **Human sign-in:** social providers only (`emailAndPassword.enabled = false`). Register Google/GitHub only when both client id and secret are set.
3. **Account linking:** enabled for the same email across trusted providers (`google`, `github`); last linked provider cannot be unlinked (enforced in Settings UX / Plan 16).
4. **Sessions:** database sessions; gate app routes with the session cookie.
5. **Tenancy:** map Better Auth `organization` onto `workspaces` (ADR 0019).
6. **Machine identity:** Better Auth API keys + env ops key fallback (refined in ADR 0023).

## Consequences

- Builds with `NODE_ENV=production` require `BETTER_AUTH_SECRET` whenever auth is imported.
- Schema drift is caught by `bun run --cwd apps/web check:auth-schema`.
- Docs that still say “Clerk” for Plan 14 are historical; runtime path is Better Auth.
- Soft device trust, security audit, and PAT cutover live in Plan 16 / ADR 0023 — not in this ADR.

## Plans touched

- Plan 14 (authentication)
- Plan 16 (account security — consumes this decision)

## References

- [`docs/roadmap.md`](../roadmap.md) — Plan 14 / 16
- [ADR 0019](./0019-workspaces-are-better-auth-organizations.md)
- [ADR 0023](./0023-account-security-soft-devices.md)
- [`docs/specs/account-security.md`](../specs/account-security.md)
