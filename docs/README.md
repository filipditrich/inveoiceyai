# Invoicey docs

This folder is the **source of truth** for product, architecture, and domain decisions on Invoicey. Code implements against these docs; docs are not generated from code.

If a doc disagrees with the code, the doc is right and the code is a bug — or the doc is stale and a new ADR must supersede it. Either way, do not silently desync.

## Layout

| Path                                   | Purpose                                                                    | Lifecycle                              |
| -------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| [`PRD.md`](./PRD.md)                   | Product requirements — use cases, MVP scope, non-goals, success criteria   | Living                                 |
| [`roadmap.md`](./roadmap.md)           | Plan 0..N with goal + exit criteria for each                               | Living                                 |
| [`architecture.md`](./architecture.md) | Stack, monorepo layout, dataflow, runtime boundaries, env vars             | Living                                 |
| [`glossary.md`](./glossary.md)         | Czech tax/invoicing terms with English equivalents                         | Living                                 |
| [`domain/`](./domain)                  | Domain contracts (invoice schema, VAT rules, numbering, status, snapshots) | Living                                 |
| [`decisions/`](./decisions)            | ADRs in Michael Nygard format, numbered, append-only                       | Append-only                            |
| [`specs/`](./specs)                    | Per-feature implementation specs (PDF, ARES, MCP, Slack, …)                | Just-in-time, written before each plan |
| [`ui/`](./ui)                          | UI/UX specs — information architecture, flows, page intents                | Just-in-time, written before each plan |
| [`research/`](./research)              | Evidence, options, and direction selection                                 | Exploratory → promoted                 |

## Lifecycle conventions

- **Living docs** (PRD, roadmap, architecture, domain, glossary) — edit any time. Commit message body should explain _why_ it changed, not just _what_.
- **ADRs** — append-only. If a decision changes:
  1. Write a new ADR with the next number (e.g. `0018-…`)
  2. Set the new ADR's `Status` to `Accepted (supersedes 0004)`
  3. Edit the old ADR's `Status` to `Superseded by 0018`
  4. Never rewrite the body of a superseded ADR
- **Specs and UI docs** — written just-in-time before the plan that consumes them. If a feature is dropped, archive its spec under `specs/_archived/` with a one-line explanation at the top.
- **Research docs** — preserve useful evidence and alternatives without creating
  roadmap commitment. Promote selected research into a spec, plan, and ADRs
  before implementation.

## Current product research

- [Payment ledger and bank integration](./research/payment-ledger-bank-integration.md)
  — Fio shipped; Czech bank API matrix concludes other direct adapters are
  deferred (paid, cert/OAuth-heavy, or PSD2-TPP-only).
  capture, extraction ladder, approval rules, and bank-signed payment batches
  for supplier invoices.
- [Czech OSVČ companion](./research/osvc-companion.md) — exploratory and not
  scheduled.
- [Personal invoice archive](./research/personal-invoice-archive.md) — selected
  as Invoicey Drive (Plan 30). Server cannot write iCloud or Proton Drive.
- [macOS archive app sketches](./research/macos-archive-app.md) — promoted into
  the Drive spec.
- [Invoicey CLI](./research/invoicey-cli.md) — selected as Plan 31 operator
  companion (PAT JSON API + `apps/cli`).

## Conventions

- **Code blocks** use TypeScript syntax. Reference real package paths (`@invoicey/invoice-core`, `@invoicey/invoice-tools`, `apps/web`, `apps/mcp`, …).
- **Cross-references** use relative markdown links: `[invoice schema](./domain/invoice-schema.md)`.
- **Czech terms** appear in original form first, with English in parentheses on first use per doc, then linked to [`glossary.md`](./glossary.md).
- **TODO markers** use `TODO(plan-N): <question>` so they're searchable and tied to the plan that resolves them.
- **Examples** must round-trip — every JSON example for the invoice schema must validate against the schema described in the same doc.

## How docs and plans relate

```mermaid
flowchart LR
    Docs["docs/<br/>(this folder)"] -->|read first| PlanN["Plan N<br/>(.cursor/plans/)"]
    PlanN -->|implement| Code["repo source"]
    Code -.->|"force rethink"| ADR["new ADR<br/>(supersedes prior)"]
    ADR --> Docs
```

Each plan in `.cursor/plans/` cites the docs it implements. Each ADR cites the plan(s) it touches.

## Reading order for newcomers

1. [`../README.md`](../README.md) — product overview
2. [`PRD.md`](./PRD.md) — what we're building and why
3. [`glossary.md`](./glossary.md) — vocabulary
4. [`architecture.md`](./architecture.md) — how the system fits together
5. [`domain/invoice-schema.md`](./domain/invoice-schema.md) — the central contract
6. [`specs/mcp.md`](./specs/mcp.md) — AI create path (local Cursor)
7. [`specs/payment-ledger-fio.md`](./specs/payment-ledger-fio.md) — payment ledger + Fio
8. [`specs/payment-ledger-moneta.md`](./specs/payment-ledger-moneta.md) — MONETA adapter
9. [`roadmap.md`](./roadmap.md) — what ships when
10. [`decisions/`](./decisions) — why each foundational call was made
11. [`research/`](./research) — possible future directions and unresolved options

## Status

Implementation progress lives in [`roadmap.md`](./roadmap.md).

- **Done:** Plans 0–12, 14, 16–21 (MVP UI through AI usage), Plan 22 implementation (payment ledger + Fio connector).
- **In progress:** Plan 13b — Eve Slack agent ([`specs/slack-eve.md`](./specs/slack-eve.md)); Plan 22 real Fio pilot + rematch/split UI polish.
- **Public product docs:** [`apps/web/content/docs/`](../apps/web/content/docs/) (served at `/docs`).
- **Automation:** Prefer MCP / Eve Slack over a heavy builder UI for day-to-day create ([`AGENTS.md`](../AGENTS.md)).

Narrative plans: [`.cursor/plans/`](../.cursor/plans/).
