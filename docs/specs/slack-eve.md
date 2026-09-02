# Slack Eve agent (Plan 13b)

Durable Slack invoicing agent on [Vercel Eve](https://eve.dev/docs), mounted in `@invoicey/web` via `withEve()`. Supersedes the Plan 13a hand-rolled AI loop.

The same agent also backs the in-app assistant panel — same tools, instructions
and HITL loop, different rendering. See [`assistant-panel.md`](./assistant-panel.md)
for what the two surfaces share and where they intentionally differ.

## Architecture

```mermaid
flowchart TB
  SlackUser["Slack mention or DM"] --> Connect["Vercel Connect Slack"]
  Connect -->|"POST /eve/v1/slack"| EveRuntime["eve runtime via withEve"]
  EveRuntime --> Tools["apps/web/agent/tools"]
  Tools --> InvoiceTools["@invoicey/invoice-tools + /ops"]
  InvoiceTools --> Neon["Neon linked workspace"]
  InvoiceTools --> Core["invoice-core PDF/ISDOC"]
  EveRuntime -->|"Thinking Steps + Card + files"| SlackAPI["Slack"]
  Cursor["Cursor"] -->|"stdio or /api/mcp"| InvoiceTools
```

| Piece         | Location                                                                                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent root    | [`apps/web/agent/`](../../apps/web/agent/)                                                                                                                                                                      |
| Mount         | [`apps/web/next.config.ts`](../../apps/web/next.config.ts) — `withEve(nextConfig)` → `/eve/v1/*`                                                                                                                |
| Slack channel | `agent/channels/slack.ts` — Connect + **live feedback** event overrides (Thinking Steps + invoice Cards)                                                                                                        |
| HTTP channel  | `agent/channels/eve.ts` — browser session cookie (in-app assistant, see [`assistant-panel.md`](./assistant-panel.md)) **or** Bearer ops key (`EVE_API_KEY` / `MCP_API_KEY`) **or** user PAT + OIDC + `localDev` |
| Domain ops    | `@invoicey/invoice-tools/ops` (`issueInvoiceById`, `markInvoicePaidById`, list/get)                                                                                                                             |
| Create/render | `@invoicey/invoice-tools` (`createAndRenderInvoice`, presets, ARES)                                                                                                                                             |

### Slack live feedback

Invoicey’s Slack channel overrides Eve defaults for richer UX (Linear-style progress):

| Phase        | Mechanism                                                                                                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turn start   | Typing `Working…`; Thinking Steps stream opens on the **first tool batch** (clarify-only turns stay quiet)                                                                                                        |
| Tool calls   | `chat.appendStream` `task_update` chunks with domain labels (ARES, create draft, upload, …)                                                                                                                       |
| HITL         | Stream stops with “Waiting for approval…” (tool approval) or “Waiting for your answer…” (`ask_question`) **before** the Eve card; the reason is kept on channel state so the `session.waiting` safety net matches |
| Tool results | Stash invoice/list Card payload; mark tasks complete with a short result snippet (no View link on the step)                                                                                                       |
| Final reply  | Stop stream with **Card only** when a card exists (no model markdown, no extra View task); otherwise markdown. Fallback: `thread.post(Card)`                                                                      |
| Card actions | Draft cards carry `Issue` / `Preview PDF` / `Discard` plus due-date, currency, VAT and language selects; issued cards carry `Mark paid` / `Send to client` / `Get PDF`. Handled by `onInteraction` — see below    |
| Artifacts    | PDF/ISDOC file uploads stay separate thread messages                                                                                                                                                              |

Helpers: `agent/lib/slack-thinking-stream.ts`, `slack-invoice-card.ts`, `slack-tool-labels.ts`, `slack-channel-extras.ts`, `invoice-card-model.ts`, `slack-invoice-actions.ts`, `slack-interactions.ts`.

### Review card and card actions

`create_invoice` and `update_invoice_draft` attach an `InvoiceCardModel` to their
result; the channel renders it. The card shows every field a wrong guess could
land in, and `normalizeDraftToInvoice` now returns `assumptions` — each field it
filled in, with a reason and a `severity`. `notable` assumptions (due date,
currency, language, price basis, VAT) get a warning block; `routine` ones (issue
date is today, DUZP follows it, docType is `invoice`) are tagged on the field
only. Nothing reaches `issue` without having been visible first.

Card controls are handled by `slack-interactions.ts`, wired to
`slackChannel({ onInteraction })`:

- Every id is namespaced `invoicey:` — Eve owns `eve_input:` / `eve_input_freeform:`
  and forwards the rest. Selects report only `selected_option.value`, so state
  rides inside the option value: `<uuid>|<mask>|<field>:<value>`.
- **One select, not four.** Slack splits an actions block's width evenly across
  its elements, so four selects collapse to single letters in a thread pane. A
  lone select spans the row; each option label already names its field.
- **`<mask>` is the still-assumed set**, a base-36 bitmask over `ASSUMABLE_PATHS`
  (`invoice-card-i18n.ts`). Slack caps an option value at 75 chars and a uuid
  eats 36, so a path list does not fit and a 2-char mask does. Without it a
  rebuilt card would drop every `assumed` tag, and editing one field would
  quietly stop flagging the others. Append to `ASSUMABLE_PATHS` only — removing
  or reordering shifts every later bit and mis-decodes live cards.
- A click resolves the **clicker's** linked workspace via `resolveLinkedSlackPrincipal`
  and runs under `runWithInvoiceyContext`. Unlinked clickers get an ephemeral
  refusal and nothing runs. This is stricter than the Slack-global Allow/Deny.
- The clicked message is replaced in place via `chat.update`, so a thread with
  five adjustments still has exactly one card per invoice.
- Failures are reported with `postEphemeral` to the clicker, never in-channel.
- The `Open in Invoicey` link button carries `invoicey:open_web` purely so the
  click it still emits is recognised and ignored.

### Language

Card copy is rendered from the invoice's `meta.language` (`invoice-card-i18n.ts`),
defaulting to `cs`. There is no per-user locale to read: `users` has no locale
column and the web app's locale lives in a `NEXT_LOCALE` cookie the agent cannot
see. A true per-user setting would need either that column or the Slack
`users:read` scope for `users.info().locale`. Model prose follows the language
the user writes in — see `instructions.md`.

Clicking `Issue` runs `issueInvoiceById` directly rather than going through the
model and a second Allow/Deny: the button sits on a card that already shows the
number, client and total, which is a more specific act of consent than a
sentence the model has to re-interpret. The `approval: always()` gate stays on
the tool for the typed path.

**Auth policy**

| Surface                      | Gate                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slack                        | Vercel Connect, then **explicit identity link** (ADR 0020). Unlinked callers get a DM to `/slack/link/[code]` and no agent turn. Linked sessions overlay Invoicey `workspaceId` + `userId`. |
| HTTP `/eve/v1/*` (non-Slack) | Bearer ops key (`EVE_API_KEY` / `MCP_API_KEY`) — Eve channel cannot import server-only PAT verify; user PATs remain on remote MCP                                                           |
| Invoice data                 | Slack: confirmed workspace on `slack_identities`. Eve HTTP: `INVOICEY_DEFAULT_WORKSPACE_ID`                                                                                                 |

**Out of v1:** slash `/invoice`, calling remote `/api/mcp` from Eve, per-click HITL principal, migrating historical ops-workspace invoices. (Human auth is Better Auth OAuth — ADR 0018; HTTP machine auth is ops key or user PAT — ADR 0023; Slack tenancy is ADR 0020.)

### Slack identity linking

1. Unlinked mention/DM → mint or reuse a 15-minute `slack_link_codes` row. **Never post the URL in a channel.** DM it; ephemeral if DM fails; channel reply is only “I sent you a DM…”.
2. Signed-in user confirms at `/slack/link/[code]` against the **current** workspace (`activeOrganizationId`). No email matching.
3. Same Invoicey user may rebind workspace. A different user cannot take over until the original unlinks in Settings → Integrations.
4. Each turn: identity exists **and** a `members` row for `(userId, workspaceId)`. Tools fail closed (`not_linked`) without overlay attributes. `persistDraftInvoice` uses ALS `workspaceId`.
5. HITL Allow/Deny is still Slack-global. Keep the bot in a private channel; Allow is a second check, not identity. Membership is re-checked at tool execute.
6. AI usage meters against the linked Invoicey user/workspace. Slack principals are never stored as `users.id`.

## Tools

| Tool                                          | Notes                                                                                                                                              |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_business`                             | ARES by company name → matches with IČO + address                                                                                                  |
| `lookup_business`                             | ARES by IČO → full client draft                                                                                                                    |
| `list_presets` / `get_preset` / `save_preset` | Preset CRUD only when the user asks; never during invoice create. Placeholder UUIDs rejected                                                       |
| `create_invoice`                              | Draft persist + render; workspace issuer locked; no preset id args; posts the review card. Does **not** upload artifacts — a draft is a proposal   |
| `update_invoice_draft`                        | Patch an existing draft (dates, currency, VAT, language, payment, client, items) and re-post its card. Totals recomputed; issued invoices rejected |
| `ask_question` (built-in)                     | Eve harness tool. Used for ARES disambiguation, price basis, currency, VAT on foreign clients                                                      |
| `upload_invoice_files`                        | Explicit upload (by `invoiceId` or base64)                                                                                                         |
| `list_invoices` / `get_invoice`               | Workspace-scoped follow-ups                                                                                                                        |
| `issue_invoice`                               | `approval: always()` HITL; requires `confirm { clientName, total }` so the Allow/Deny card shows more than a uuid; numbering + upload              |
| `mark_invoice_paid`                           | `approval: always()` HITL; requires `confirm { number, total }`                                                                                    |
| `send_invoice_email`                          | `approval: always()` HITL; requires `confirm { number, clientName }`; PDF + optional ISDOC via Resend                                              |

Skill: `skills/create-czech-invoice.md`.

## You must (human-only setup)

The agent cannot complete these steps:

1. **Vercel CLI login** and link the Invoicey web project (`vercel link` from `apps/web` or the monorepo root that owns the project).
2. **Create Slack Connect client** and point the trigger at Eve:
   ```bash
   vercel connect create slack --triggers
   vercel connect detach <uid> --yes
   vercel connect attach <uid> --triggers --trigger-path /eve/v1/slack --yes
   ```
   UID must match `connectSlackCredentials("slack/invoicey")` in `agent/channels/slack.ts`.
3. In Connect **Advanced**: subscribe to `message.channels` (+ `message.groups` for private), scopes at least `channels:history` / `groups:history`, `files:write`, `files:read`, `chat:write`, `app_mentions:read`, `im:history`, `im:write`; **reinstall** the Slack app.
4. Deploy with experimental eve recognition:
   ```bash
   VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1 vercel deploy --prod
   ```
   (or `eve deploy` / ensure `withEve` generated services).
5. Set Vercel env: `DATABASE_URL`, `AI_GATEWAY_API_KEY` (or OIDC), `INVOICEY_DEFAULT_WORKSPACE_ID`, `EVE_API_KEY` and/or `MCP_API_KEY`, `NEXT_PUBLIC_APP_URL`, UploadThing if issuer assets needed. Optional: `INVOICEY_AI_MODEL`.
6. Invite the bot to the target channel; run the E2E checklist below once.
7. If Deployment Protection is on, supply a bypass secret for Connect / health checks.

**Runtime:** Node **24+** (eve engines). Local: `node -v` ≥ 24.

## What the agent implements

- `apps/web/agent/**`, `withEve`, domain API extract, Neon wiring, HITL tools, docs, `.env.example`, retirement of Plan 13a `/api/slack/*` routes.

## E2E checklist

| #   | Scenario                          | Pass                                                                                                                                                                                                                                                                                           |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `@Invoicey` + NL invoice + IČO    | Draft in Neon; **review card** posted with all fields, assumed ones tagged; no PDF uploaded yet                                                                                                                                                                                                |
| 2   | Thread follow-up without `@`      | Session continues                                                                                                                                                                                                                                                                              |
| 3   | Card **Issue invoice**            | Number from scheme; `issued_at`; PDF+ISDOC upload; the same card message updates in place to the issued state                                                                                                                                                                                  |
| 4   | Card **Mark paid**                | `paid_at` set; card updates in place                                                                                                                                                                                                                                                           |
| 5   | Unpaid list                       | `list_invoices` / `get_invoice` answer from Neon                                                                                                                                                                                                                                               |
| 6   | Presets                           | `save_preset` / `list_presets` hit Neon                                                                                                                                                                                                                                                        |
| 7   | Deploy                            | `GET /eve/v1/health` OK; Connect hits `/eve/v1/slack`                                                                                                                                                                                                                                          |
| 8   | Regression                        | Cursor MCP `create_invoice` + web Issue UI still work                                                                                                                                                                                                                                          |
| 9   | Live card / Thinking Steps        | One streamed progress message (or Card fallback) with domain task labels; final Card or stream includes **View in Invoicey**; PDF/ISDOC still upload as files. If streaming is unavailable, Vercel logs `[invoicey-slack] chat.startStream failed:` and the thread uses typing + a final Card. |
| 10  | List Card                         | `list_invoices` yields a compact multi-field Card (not a long prose table)                                                                                                                                                                                                                     |
| 12  | Unlinked Slack user               | No agent turn; DM with `/slack/link/…`; channel does not contain the URL                                                                                                                                                                                                                       |
| 13  | Confirm link in current workspace | Next Slack message creates invoices in that workspace; Settings shows the link                                                                                                                                                                                                                 |
| 14  | Card **due-date select**          | Picking “Due in 30 days” rewrites `due_date` off the issue date and the card re-renders in place; the `assumed` tag on Due date is gone                                                                                                                                                        |
| 15  | Card **currency / VAT change**    | Totals recompute (VAT changes with reverse charge); an invalid combination (OSS · domestic) is refused with an ephemeral message and the card is untouched                                                                                                                                     |
| 15b | Assumption carry-forward          | After changing the due date, `Splatnost` loses its tag while `Měna` / `Jazyk dokladu` keep theirs and stay in the warning block                                                                                                                                                                |
| 15c | One change menu                   | The draft card shows a single full-width **Změnit…** select, not four one-letter boxes                                                                                                                                                                                                         |
| 16  | Card **Discard**                  | Draft row deleted; card replaced by a tombstone naming the clicker                                                                                                                                                                                                                             |
| 17  | Card click by unlinked user       | Ephemeral refusal; nothing mutates                                                                                                                                                                                                                                                             |
| 18  | Correction in words               | “make it EUR” calls `update_invoice_draft` on the same id — no second draft row                                                                                                                                                                                                                |
| 19  | Ambiguous client                  | `ask_question` renders as radio/select options, one per ARES match; thread says “Waiting for your answer…”, not “Waiting for approval…”                                                                                                                                                        |
| 20  | Typed **Issue**                   | Allow/Deny card shows client + total from `confirm`, not a bare uuid                                                                                                                                                                                                                           |

## Deploy note

Production (`inveoiceyai-web` / https://invoicey.app) builds with `VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1`. Eve requires **`ai` ^7** (peer of `eve@0.31.x`). Health probe:

```bash
curl -sS https://invoicey.app/eve/v1/health
# {"ok":true,"status":"ready",...}
```

**Turbo remote cache:** `@invoicey/web` build must not be turbo-cached on Vercel. A cache hit can skip the `withEve` nitro packaging, leave `/eve/v1/*` as Next HTML, and make Slack Connect look “healthy” (HTTP 200 HTML) while Eve never runs. Guard: `apps/web/turbo.json` sets `build.cache: false` and includes `.eve/**` in outputs. Symptom of a bad deploy: `GET /eve/v1/health` returns marketing HTML/`404` instead of JSON `ready`, and `lambdaRuntimeStats.nodejs` drops (e.g. 4 instead of 7). Fix: promote the last Eve-good deployment or `vercel redeploy <id> --target production` (full rebuild).

**PDF fonts in Eve:** Next `outputFileTracingIncludes` does **not** ship into Eve’s nitro `__server.func`. Without assets, Slack `create_invoice` fails with `Missing invoice-core asset 'fonts/Inter-Regular.ttf'`. Guard: `withEve(..., { eveBuildCommand: "node ./scripts/eve-build-with-assets.mjs" })` copies `packages/invoice-core/assets` into the function after `eve build`, plus static `new URL(..., import.meta.url)` font refs in `register-fonts.ts`.

## Local smoke

```bash
# from apps/web (Node 24+)
bunx eve info
bunx eve build
curl -sS https://invoicey.app/eve/v1/health
```

`bun dev` boots Next + eve via `withEve` when credentials allow.

## Related

- Historical Plan 13a: [`slack-bot.md`](./slack-bot.md)
- MCP toolkit: [`mcp.md`](./mcp.md)
- Slack identity: [ADR 0020](../decisions/0020-slack-identity-linking.md)
- Roadmap Plan 13b: [`../roadmap.md`](../roadmap.md)
