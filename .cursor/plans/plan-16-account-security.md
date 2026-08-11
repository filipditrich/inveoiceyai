# Plan 16 — Account security & settings

Maps to roadmap **Plan 16**. Spec: [`docs/specs/account-security.md`](../../docs/specs/account-security.md). ADR: [`0023`](../../docs/decisions/0023-account-security-soft-devices.md).

## Goal

Settings security surface (linked OAuth, sessions, soft trusted devices + new-sign-in email), members/invites UI, API keys UI with MCP/Eve PAT cutover, light audit log + auth rate limits — on Better Auth + Resend (not Clerk).

## Exit criteria

- [ ] Settings subnav: Appearance, Security, Members, API keys + nav entry
- [ ] Link/unlink providers with last-provider guard
- [ ] List/revoke sessions + revoke others; IP headers configured
- [ ] Soft trusted devices + `new_sign_in` email + trust link; login never blocked
- [ ] Security audit feed for key events
- [ ] Members invite/list/role/remove + `/invite/[id]` accept
- [ ] API keys UI; MCP + Eve accept user PAT **or** env ops key; tools use resolved workspace
- [ ] BA DB rate limit + BotID on auth surfaces
- [ ] Spec + ADR 0023 + roadmap Plan 14 Done / Plan 16
- [ ] `typecheck` / `lint` / `test` green

## Locked decisions

- Soft device trust (always allow sign-in)
- PAT cutover with env ops fallback
- No passwords / TOTP / account deletion / Slack identity UI
