# Plan 13a — Slack bot (stateless demo)

**Roadmap:** [Plan 13a in docs/roadmap.md](../../docs/roadmap.md)

## Doc inputs

- [`docs/specs/slack-bot.md`](../../docs/specs/slack-bot.md) — single source of truth for architecture, tools, env, failure modes.
- [`docs/specs/ares.md`](../../docs/specs/ares.md), [`docs/specs/isdoc.md`](../../docs/specs/isdoc.md), [`docs/specs/pdf-rendering.md`](../../docs/specs/pdf-rendering.md)
- [`docs/architecture.md`](../../docs/architecture.md) — env vars table + Future hooks diagram.

## Execution order

1. **Deps.** Add to `apps/web`:
   - `ai`, `@ai-sdk/gateway` (Vercel AI SDK + AI Gateway)
   - `slack-edge` (signature-verifying receiver, Web-Standard `Request`/`Response`)
   - `@slack/web-api` (for `chat.postMessage` + `files.uploadV2`)
2. **Demo issuer.** [`apps/web/lib/demo-issuer.ts`](../../apps/web/lib/demo-issuer.ts) — `getDemoIssuer()` reading optional `INVOICEY_DEMO_ISSUER_JSON`, falling back to a hard-coded `IssuerSnapshot`.
3. **AI tool surface.** [`apps/web/lib/slack/ai-tools.ts`](../../apps/web/lib/slack/ai-tools.ts) — `lookup_business`, `parse_amount_cz`, `compute_due_date`, `compute_totals`, `assemble_and_validate`, `render_pdf`, `render_isdoc`. Each tool is a Vercel AI SDK `tool({ description, parameters: z.object(…), execute })`.
4. **AI worker.** [`apps/web/lib/slack/run-ai-worker.ts`](../../apps/web/lib/slack/run-ai-worker.ts) — `runAiWorker({ text, issuer })` calls `generateText({ model, tools, system, prompt, maxSteps: 8 })` and returns `{ ok: true; invoice; pdfBytes; isdocXml } | { ok: false; reason; issues? }`.
5. **Slack route.** [`apps/web/app/api/slack/commands/route.ts`](../../apps/web/app/api/slack/commands/route.ts):
   - `export const runtime = "nodejs"`.
   - Verify signature with `slack-edge`.
   - Ack `{ response_type: "ephemeral", text: "Generuji fakturu…" }`.
   - `after(async () => { … })` runs `runAiWorker`, posts result via `response_url` + `files.uploadV2` (or error).
6. **Env.** Add to repo `.env.example` and `docs/architecture.md` env table: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `AI_GATEWAY_API_KEY`, `INVOICEY_AI_MODEL`, `INVOICEY_AI_FALLBACK_MODEL`, `INVOICEY_DEMO_ISSUER_JSON`.
7. **Tests.** Vitest:
   - Each tool wrapper (with ARES recorded fixture).
   - Worker integration with a stubbed `generateText` step list — happy path + retry-on-validation path; assert valid `Invoice`, non-empty PDF (`%PDF` smoke), ISDOC validating against vendored XSD.
   - `slack-edge` signature verification helper.
8. **Slack app.** Create `Invoicey (demo)` app in api.slack.com with manifest from [`docs/specs/slack-bot.md`](../../docs/specs/slack-bot.md). Install to test workspace; copy bot token + signing secret into Vercel project env.
9. **Smoke.** ngrok → `/invoice NFCtron 50000 retainer květen splatnost 14` → PDF + ISDOC posted in thread; QR scans correctly.

## Verification

- `bun run typecheck && bun run lint && bun run test && bun run build` at repo root green.
- New Vitest suite in `apps/web` (or in a shared spot) green.
- Manual: ngrok smoke — file uploads visible in Slack thread; ISDOC opens in a XSD validator without errors.

## Exit criteria

- [ ] `/api/slack/commands` route handler verifies Slack signatures and acks within Slack's 3s window.
- [ ] AI tool surface in [`apps/web/lib/slack/ai-tools.ts`](../../apps/web/lib/slack/ai-tools.ts) matches the table in [`docs/specs/slack-bot.md`](../../docs/specs/slack-bot.md) §Tool surface.
- [ ] Worker iterates `assemble_and_validate` failures and recovers (covered by integration test).
- [ ] On success: PDF + ISDOC posted in-thread via `files.uploadV2`.
- [ ] On failure: Czech-language ephemeral message lists offending fields; raw issues logged.
- [ ] All new env vars documented in `.env.example` + [`docs/architecture.md`](../../docs/architecture.md).
- [ ] `bun run typecheck && bun run lint && bun run test && bun run build` green.
- [ ] Smoke test against a real Slack workspace passes; QR scans correctly in a Czech bank app.

## Open TODOs

- `TODO(plan-13a-impl):` Decide whether to add a `slack` scope to [`commitlint.config.mjs`](../../commitlint.config.mjs) (only if we end up extracting `apps/slack`); for stateless-demo all commits go under scope `web` or `docs`.
- `TODO(plan-13a-impl):` Confirm Vercel `after()` timeout fits the worst-case AI loop + render (~25-30s on cold start). If not, budget moves to a queue (QStash / Inngest) — that promotes us into 13b.
- `TODO(plan-12):` Tool surface here is the same shape MCP will expose — when Plan 12 lands, lift these into `apps/mcp` and have the Slack bot consume them via the AI SDK MCP client.
- `TODO(plan-13b):` DB-persisted drafts, real `nextInvoiceNumber`, `Issue`/`Mark paid` Slack interactivity buttons, Slack-user → Invoicey-user mapping (depends on Plan 14 auth).
