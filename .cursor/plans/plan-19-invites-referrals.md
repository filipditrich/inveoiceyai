# Plan 19 — Workspace invites + referral attribution

Maps to roadmap **Plan 19**. ADR: [`docs/decisions/0025-referral-attribution.md`](../../docs/decisions/0025-referral-attribution.md). Spec: [`docs/specs/account-security.md`](../../docs/specs/account-security.md).

## Goal

Polish Better Auth workspace invites (email, accept UX, i18n, resend/cancel/expiry, audit) and ship user-specific referral links that attribute new signups only — never auto-join a workspace — with durable codes and event logs.

## Exit criteria

- [x] Invite email polish + `expiresAt` in template; `invitationExpiresIn` explicit (48h)
- [x] Members UI: i18n, expiry, resend/cancel, audit (`invite_*`)
- [x] Rich `/invite/[id]` (preview, mismatch/expired/reject) + i18n
- [x] `users.referral_code` / `referred_by_user_id` + `referral_events`
- [x] `/r/[code]` cookie + click log; signup attribution on first session
- [x] `/settings/referrals` + admin users columns
- [x] ADR 0025 + roadmap + account-security/email specs
- [x] Typecheck / focused tests
- [x] Schema applied on Neon

## Explicitly out of scope

- Referral rewards / billing
- Auto-join referrer workspace
- Bilingual transactional invite emails
- MCP/Eve referral tools
