# 0023: Soft trusted devices + PAT cutover for machine auth

## Status

Accepted (Plan 16, 2026-08-11)

## Context

Plan 14 landed Better Auth (OAuth-only Google/GitHub, DB sessions, org→workspaces). Plan 11 landed Resend. We need account security UX (linked providers, sessions, devices) and personal API keys for MCP/Eve without passwords or hard login gates.

Alternatives considered:

1. **Hard device gating** — block or limit sessions until trusted via email. High lockout risk (VPN, mobile carriers, cookie clears).
2. **Trusted-device only via IP/UA heuristics** — noisy; not a stable device identity.
3. **Replace env `MCP_API_KEY` entirely** — breaks ops/shared automation overnight.

## Decision

1. **Soft trust:** unrecognized device never blocks sign-in. Emit `new_sign_in` email + offer Trust; Settings can revoke devices/sessions.
2. **Device cookie:** httpOnly `invoicey_did` (random id); store `HMAC(secret, id)` in `trusted_devices`.
3. **Last provider guard:** OAuth-only accounts cannot unlink their final linked provider.
4. **Machine bearer:** accept Better Auth user PAT **or** env ops key (`MCP_API_KEY` / `EVE_API_KEY`). User PAT → `users.defaultWorkspaceId`; ops → `INVOICEY_DEFAULT_WORKSPACE_ID`.
5. **Audit:** append-only `security_audit_events` for sign-in, session revoke, link/unlink, device trust/revoke, API key create/revoke, member/invite mutations.
6. **Rate limit:** Better Auth `rateLimit.storage = "database"`; BotID on sign-in / auth routes only.

## Consequences

- Security mail requires `defaultWorkspaceId` for `email_messages.workspace_id` (transport constraint); missing workspace logs and skips mail without failing login.
- Eve Slack Connect sessions resolve workspace via explicit Slack identity linking (ADR 0020), not the ops default.
- Operators keep a shared env key for CI/automation alongside per-user PATs.

## Plans touched

- Plan 16 (account security)

## References

- [`docs/specs/account-security.md`](../specs/account-security.md)
- ADR 0018 / 0019 (Better Auth + workspaces)
- ADR 0022 (Resend)
