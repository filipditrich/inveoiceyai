# 0026: Workspace AI tokens as entitlement unit

## Status

Accepted (2026-08-12)

## Context

Invoicey hosts LLM calls on Web AI (`/invoices/ai`) and Eve/Slack. Remote MCP runs tools on Invoicey while the language model usually sits in the client. We need a measurable, member-visible entitlement that matches tenancy (ADR 0007) without inventing a payment system yet.

## Decision

1. Store **token balances per workspace** (`ai_token_balances`) with three buckets: gifted (signup), monthly included (no rollover), purchased (stubbed at 0).
2. Append **usage events** (`ai_usage_events`) with `product` (`web` | `slack` | `mcp`) and `kind` (`llm` | `tool_call`).
3. Debit real LLM tokens only for Invoicey-hosted models (`web`, `slack`). Log MCP tool calls without debiting.
4. Debit order: monthly → gifted → purchased.
5. Gate Web and Eve when total available tokens are 0; show Usage UI for all members.
6. Renew monthly periods via Vercel cron + ops script; do not roll over unused monthly tokens.

## Consequences

- Multi-member workspaces share one AI budget (aligned with shared invoices).
- MCP client LLM spend is not Invoicey’s responsibility; UI must explain that.
- Top-up / payments can later credit `purchased_remaining` without schema redesign.
- Lazy `ensureAiTokenBalance` covers workspaces created before this change.

## Alternatives considered

**Per-user credits.** Rejected — conflicts with ADR 0007 billing/permissioning unit and Slack multi-member use.

**Abstract “credits” instead of tokens.** Rejected — less transparent than provider-reported tokens.

**Debiting MCP with estimated tokens.** Rejected — inaccurate; activity log is enough for transparency.

## Plans touched

- In-app AI invoice draft + workspace token usage

## References

- [ADR 0007](./0007-workspace-scoped-data-model.md)
- [docs/specs/ai-usage.md](../specs/ai-usage.md)
