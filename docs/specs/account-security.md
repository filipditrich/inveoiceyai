# Account security

Plan 16. ADR [0023](../decisions/0023-account-security-soft-devices.md).

## Settings IA

| Route                | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| `/settings`          | Appearance (theme)                                       |
| `/settings/security` | Sign-in methods, sessions, trusted devices, recent audit |
| `/settings/members`  | Workspace members + invites                              |
| `/settings/api-keys` | Personal access tokens                                   |

Nav: user menu → Settings. Invite accept: `/invite/[id]` (public, requires sign-in).

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

Verify order:

1. Env ops key (`MCP_API_KEY` or `EVE_API_KEY` for Eve) → ops workspace.
2. Else `auth.api.verifyApiKey({ key })` → user `defaultWorkspaceId`.

MCP HTTP and Eve HTTP both use this. Tools resolve workspace via request ALS (MCP) or Eve session `attributes.workspaceId`.

## Members

- Roles: `owner` | `admin` | `member` (Better Auth organization defaults).
- Invite email already wired (Plan 11); UI shows copyable `/invite/<id>` fallback.
- Mutations: owner/admin only.

## Audit events

`security_audit_events.type`:

`sign_in` | `session_revoke` | `account_link` | `account_unlink` | `device_trust` | `device_revoke` | `api_key_create` | `api_key_revoke` | `invite_create` | `member_remove` | `member_role_update`

## Rate limiting

- Better Auth database rate limit table.
- BotID on `/sign-in` and `/api/auth/*` only.
