# 0042: Drive pairing is web sign-in plus a one-time callback code

## Status

Accepted (grill 2026-09-01)

## Context

The Mac app must act as the signed-in Invoicey user. Better Auth is OAuth-only Google/GitHub ([ADR 0018](./0018-better-auth-oauth-only.md)). Machine callers already use Better Auth PATs or an env ops key ([ADR 0023](./0023-account-security-soft-devices.md)). Slack uses an explicit web confirm, never silent email match ([ADR 0020](./0020-slack-identity-linking.md)).

A Drive connect URL that returns a long-lived PAT in the query string would leak the key via browser history, logs, and crash reports.

## Decision

1. Pairing **starts in the Mac app** (it holds the PKCE verifier). Account Settings does not offer a fake Connect button.
2. The app opens `ASWebAuthenticationSession` to `https://invoicey.ditrich.me/drive/connect` with a PKCE challenge. Production callback is **Associated Domains** on `invoicey.ditrich.me`. Local/dev may use `invoicey-drive://oauth`.
3. The user signs in with the existing Better Auth session (or completes Google/GitHub).
4. The signed-in user confirms **Connect this Mac** on a first-class web page. The page names the user and lists workspaces that will appear in Drive.
5. The server creates a `drive_devices` row and a **one-time grant code** (short TTL, single use).
6. The callback carries only that code. The Mac app `POST`s `/api/drive/token` with the PKCE verifier and receives a **Drive device token** (not a Settings PAT). Store the token in the macOS Keychain.
7. The device token lives **until revoke**. Heartbeat `last_seen_at`. No refresh token. No device cap. Sign out on the Mac revokes that device.
8. Drive HTTP routes (`/api/drive/*`) accept that device token only. They do not accept the env ops key. They do not accept a cookie session from the File Provider extension.
9. Account Settings → Invoicey Drive lists devices (name, last seen) and can revoke. Revoke stops the Mac immediately.

This is the Slack link pattern applied to a native client: explicit web confirm, fail closed, no email match.

## Consequences

- `/api/invoices/[id]/pdf` stays cookie-session for the website. Drive downloads go through `/api/drive/...`.
- A Settings PAT can still be used for MCP. Drive does not reuse that PAT as the install credential.
- Audit `drive_device_create` / `drive_device_revoke` on `security_audit_events`.

## Alternatives rejected

**Paste a Settings PAT into the Mac app.** Fast for a toy. Rejected as the product path: no device list, no revoke-by-Mac, easy to over-scope.

**PAT in the callback URL.** Rejected: secret in a redirect.

## Plans touched

- Plan 30

## References

- [`specs/invoicey-drive.md`](../specs/invoicey-drive.md)
- [`specs/account-security.md`](../specs/account-security.md)
- [ASWebAuthenticationSession](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession)
