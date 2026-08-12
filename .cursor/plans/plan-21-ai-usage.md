# Plan — In-app AI draft + workspace token usage

**Status:** Implemented  
**ADR:** [0026](../../docs/decisions/0026-workspace-ai-tokens.md) · [spec](../../docs/specs/ai-usage.md)

## Goal

Single-prompt Web AI → `InvoiceSchema` draft, plus workspace token balances (gifted / monthly / purchased), per-product usage history, and hard gates when empty.

## Exit criteria

- [x] `ai_token_balances` + `ai_usage_events`; grant on workspace create
- [x] Token service (assert / record LLM / record MCP activity / renew)
- [x] Cron + renew script
- [x] `/invoices/ai` + `/api/ai/invoice`
- [x] Eve Slack metering + MCP activity log
- [x] Settings Usage UI + sidebar chip; cs/en
- [x] Spec + ADR 0026
