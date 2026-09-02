# Account security

Plan 16 (+ Plan 19 invites/referrals). ADR [0020](../decisions/0020-slack-identity-linking.md) · [0023](../decisions/0023-account-security-soft-devices.md) · [0025](../decisions/0025-referral-attribution.md).

## Settings IA

| Route                              | Purpose                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `/settings/account`                | Appearance (theme)                                                       |
| `/settings/account/security`       | Sign-in methods, sessions, trusted devices, recent audit                 |
| `/settings/workspace/members`      | Workspace members + email invites                                        |
| `/settings/account/referrals`      | Personal product referral link + click/signup stats                      |
| `/settings/workspace/api-keys`     | Personal access tokens + interactive remote MCP setup                    |
| `/settings/workspace/integrations` | Slack identity (unlink/rebind), Slack (use + operator), MCP entry points |

Nav: user menu → Settings. Workspace invite accept: `/invite/[id]` (requires sign-in). Slack link confirm: `/slack/link/[code]` (requires sign-in). Product referral landing: `/r/[code]` (public).

## Linked providers

- Sources: Better Auth `accounts` (`google`, `github`).
- Link via `linkSocial`; unlink via `unlinkAccount`.
- **Guard:** refuse unlink when it would leave zero providers.

## Sessions

- List/revoke via Better Auth (`listSessions`, `revokeSession`, `revokeOtherSessions`).
- Display: UA summary, IP, created, current session badge.
- After linking a new provider: revoke other sessions.

## Soft trusted devices

1. Cookie `invoicey_did` (httpOnly, `Secure` in prod, `SameSite=Lax`, long-lived).
2. On `session.create.after`: hash cookie → lookup `trusted_devices`; if trusted, bump `lastSeenAt`; else send `new_sign_in` with signed trust token.
3. `/security/trust?token=…` activates device; never blocks login.
4. Settings lists devices; revoke sets `revoked_at`.

## New sign-in email

- Template id: `new_sign_in`.
- CTA: Trust this device + Open security settings.
- Transport: `sendTransactionalEmail` with `workspaceId = user.defaultWorkspaceId`.
- Failures are logged; login proceeds.

## API keys / machine auth

**Remote MCP** (`/api/mcp`) and **Invoicey CLI** (`/api/companion`) verify order:

1. Env ops key (`MCP_API_KEY`) → ops workspace.
2. Else `auth.api.verifyApiKey({ key })` → user `defaultWorkspaceId`.

The CLI stores the PAT in `~/.invoicey/cli.json` (mode `0600`) or
`INVOICEY_API_KEY`. It does not use Drive device tokens. The command itself is
a Bun-compiled binary at `~/.invoicey/bin/invoicey`, installed from the public
checksum-verified release or compiled locally with `bun run invoicey:install`.

**Eve HTTP** (`/eve/v1/*`, non-Slack): ops `EVE_API_KEY` or `MCP_API_KEY` (or OIDC / localDev). User PATs are **not** accepted.

**Slack Eve**: Vercel Connect → `/eve/v1/slack`. Unlinked Slack users are refused (DM to `/slack/link/[code]`). Linked sessions use `slack_identities` (Invoicey user + workspace). Not Settings PATs. HITL Allow/Deny is not a per-click identity check — keep the bot in a private channel.

MCP tools resolve workspace via request ALS; Eve Slack via the linked identity overlay (fail closed without it). Eve HTTP ops keeps the env default workspace.

## Members (workspace invites)

- Roles: `owner` | `admin` | `member` (Better Auth organization defaults).
- Invite email via `organization.sendInvitationEmail` → `workspace_invite` (Plan 11); UI shows copyable `/invite/<id>` fallback.
- `invitationExpiresIn`: **48 hours** (explicit in auth config).
- Pending invites: show expiry; actions **copy link / resend / cancel** (Better Auth `inviteMember({ resend: true })`, `cancelInvitation`).
- Accept page loads invitation preview (workspace, inviter, role, invitee email, expiry). States: pending (accept/decline), expired, canceled/handled, **email mismatch** (signed-in email ≠ invite email → block accept).
- Mutations: owner/admin only for invite/resend/cancel/role/remove.

## Referrals (product attribution)

- Each user has stable unique `users.referral_code`; optional `users.referred_by_user_id` set once at signup.
- Public `GET /r/[code]` sets httpOnly cookie `invoicey_ref` (~30d), logs `referral_events` (`click`) when the cookie changes, then redirects to `/r/[code]/land`.
- Session create attributes only for accounts created within ~1 hour when `referred_by` is still null (cookie → referrer; reject self-referral); logs `signup` event.
- Referrals never create workspace membership (ADR 0025).
- Settings `/settings/account/referrals`: personal link + click/signup counts. Admin users list shows code / referred-by when present.

## Audit events

`security_audit_events.type`:

`sign_in` | `session_revoke` | `account_link` | `account_unlink` | `device_trust` | `device_revoke` | `api_key_create` | `api_key_revoke` | `invite_create` | `invite_resend` | `invite_cancel` | `invite_accept` | `invite_reject` | `member_remove` | `member_role_update` | `platform_admin_grant` | `platform_admin_revoke` | `slack_link` | `slack_unlink` | `slack_rebind`

Growth trail lives in `referral_events` (not security audit).

## Rate limiting

- Better Auth database rate limit table.
- BotID on `/sign-in` and `/api/auth/*` only.
