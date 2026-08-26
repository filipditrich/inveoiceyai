# AI usage and workspace tokens

## Purpose

Meter Invoicey-hosted AI against a **workspace-scoped token balance**, show transparent usage in Settings, and gate features when the pool is empty. Purchased top-up is stubbed for a later payment phase.

## Entitlement model

| Bucket        | Grant                                             | Rollover                        |
| ------------- | ------------------------------------------------- | ------------------------------- |
| **Gifted**    | `SIGNUP_GIFTED_TOKENS` (500k) on workspace create | Until spent                     |
| **Monthly**   | `MONTHLY_INCLUDED_TOKENS` (1M) per 30-day period  | **No** — unused monthly expires |
| **Purchased** | Stubbed at 0                                      | Until spent (future top-up)     |

**Debit order:** monthly → gifted → purchased.

**Shared:** balance is per workspace (ADR 0007); all members share one pool.

Constants and tables live in `@invoicey/db` (`ai_token_balances`, `ai_usage_events`).

## Products

Every usage event has `product`:

| Product | Kind        | Debits tokens? | Source                         |
| ------- | ----------- | -------------- | ------------------------------ |
| `web`   | `llm`       | Yes            | `/api/ai/invoice` (AI Gateway) |
| `slack` | `llm`       | Yes            | Eve hook on `step.completed`   |
| `mcp`   | `tool_call` | **No**         | Remote MCP `onToolCall`        |

MCP activity is logged for transparency. The LLM for MCP usually runs in Cursor/the client — Invoicey never sees those tokens.

## Surfaces

- **Web:** `/invoices/ai` — single prompt → tools → `InvoiceSchema` draft + PDF preview; gated by `assertHasTokens`.
- **Eve / Slack:** `agent/hooks/ai-token-usage.ts` — `turn.started` fails closed when empty; `step.completed` records usage.
- **MCP:** `/api/mcp` registers tools with `onToolCall` → `recordToolActivity`.

## Renewal

- Cron: `GET /api/cron/ai-token-renewal` daily (`vercel.json`), `Authorization: Bearer ${CRON_SECRET}`.
- Manual: `bun run --cwd packages/db scripts/renew-ai-tokens.ts [--workspace=id] [--apply]`.

Renewal sets `monthly_remaining = monthly_limit` and advances `period_start` / `period_end`. No monthly rollover.

## UI

- Settings → **Usage** (`/settings/workspace/usage`): plan stub, balance breakdown, 30-day chart, history, top-up stubs.
- Sidebar token chip with popover breakdown (all members).

## Ops notes

- Existing workspaces get a balance row lazily via `ensureAiTokenBalance` on first read/use.
- Apply schema: `packages/db/sql/2026-08-12-ai-token-usage.sql` or `bun db:push`.
