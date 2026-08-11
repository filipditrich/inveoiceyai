# 0025: Referral links are signup attribution only

## Status

Accepted (Plan 19, 2026-08-11)

## Context

Workspace membership uses Better Auth organization invitations ([ADR 0019](./0019-workspaces-are-better-auth-organizations.md)): email-bound, join a specific workspace. Separately we want personal “invite a friend to Invoicey” links for growth measurement.

Options:

1. **Reuse org invitations as open join codes** — conflates seats with product growth; forces email + org membership.
2. **Personal link that auto-joins the referrer’s workspace** — wrong tenancy model for cold referrals; surprises both parties.
3. **Attribution-only personal link** — new user still gets a personal workspace; we record who referred them.

## Decision

1. Each user gets a stable unique `users.referral_code` (generated on create; ensure-on-read for older rows).
2. Public route `GET /r/[code]` (Route Handler) sets httpOnly cookie `invoicey_ref` (~30 days), logs a `referral_events` click when the cookie changes, then redirects to `/r/[code]/land`.
3. On session create for a **new** account (created within ~1 hour), if `users.referred_by_user_id` is still null, resolve the cookie to a referrer and set it once; append a `signup` event. Never overwrite attribution; never attribute returning users.
4. Referral links never create workspace membership. Workspace invites stay on Better Auth `invitations` + `/invite/[id]`.
5. Append-only `referral_events` (`click` | `signup`) is the audit trail for growth; Settings shows personal link + click/signup counts.

## Consequences

- Growth attribution is orthogonal to workspace seats and platform admin.
- Cookie capture can miss private/incognito or cleared cookies — acceptable for v1; no rewards depend on it yet.
- Self-referral (cookie points at the same new user) is rejected.

## Alternatives considered

**Open workspace join links.** Deferred — different product (seat sharing without email).

**Rewards / credits.** Out of scope until attribution data exists.

## Plans touched

- Plan 19 (workspace invites + referral attribution)

## References

- [ADR 0018](./0018-better-auth-oauth-only.md)
- [ADR 0019](./0019-workspaces-are-better-auth-organizations.md)
- [specs/account-security.md](../specs/account-security.md)
