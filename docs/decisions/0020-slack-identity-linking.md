# 0020: Explicit Slack identity linking (no email match)

## Status

Accepted (2026-08-12)

## Context

The Eve Slack bot authenticates as the **deployment** (`defaultSlackAuth`, principal `slack:<team>:<user>`). Invoice tools historically fell back to `INVOICEY_DEFAULT_WORKSPACE_ID`, so anyone who could mention the bot invoiced into the ops workspace. Tables `slack_identities` and `slack_link_codes` existed from Plan 14 but were unused. Slack app scopes do not include `users:read.email`; Google/GitHub emails often differ from Slack anyway.

## Decision

1. **Refuse unlinked callers.** No agent turn, no ARES, no drafts. The bot DMs a one-shot `/slack/link/[code]` URL (15 minutes, single use). The URL is never posted in a channel; ephemeral is the fallback if DM fails.
2. **Explicit web confirm.** The signed-in user confirms against `requireWorkspace()` (current `activeOrganizationId`). No silent email matching.
3. **One Slack account → one Invoicey user + one workspace.** Unique `(slack_team_id, slack_user_id)`. Same Invoicey user may rebind workspace. A different user cannot steal the identity until the original unlinks in Settings.
4. **Runtime overlay.** Linked + still a workspace member → Eve auth `attributes.workspaceId` and `attributes.userId` (Invoicey ids). Tools fail closed (`not_linked`) when the Slack authenticator lacks those attributes. `persistDraftInvoice` must receive ALS `workspaceId`.
5. **Metering.** Never store a Slack principal as `users.id`. After linking, usage is attributed to the Invoicey user on the linked workspace; Slack ids stay in event metadata.
6. **HITL Allow/Deny** remains Slack-global (Eve does not expose a per-click Slack principal). Membership is re-checked at tool execute. Keep the bot in a private channel; Allow is a second check, not identity.

## Consequences

- Historical Slack invoices stay on the ops/default workspace; only **new** invoices follow the confirmed workspace. Confirm copy must name that workspace.
- Eve HTTP (`/eve/v1/*` non-Slack) keeps the env default workspace.
- Removing a member without unlinking refuses the next Slack turn until they re-link to a workspace they belong to.

## Alternatives considered

**Silent email match** (`users:read.email`). Rejected — current scopes omit it, and OAuth emails often differ from Slack.

**Shared ops workspace for everyone in the channel.** Rejected — too much blast radius once the bot is in a customer Slack.

## References

- [`docs/specs/slack-eve.md`](../specs/slack-eve.md)
- [`docs/specs/account-security.md`](../specs/account-security.md)
- ADR 0018 / 0019 (Better Auth + workspaces)
- ADR 0023 (machine auth; Slack no longer uses ops default after this ADR)
