<h1 align="center">Invoicey</h1>

<h4 align="center">Czech-first invoicing — schema-first data, PDF + ISDOC + SPAYD QR</h4>

<p align="center">
  <img src="https://img.shields.io/badge/status-Plan%201%20bootstrap%20done-brightgreen?style=for-the-badge" alt="Plan 1 bootstrap done" />
  <img src="https://img.shields.io/badge/commits-conventional%20Commits-ff69b4?style=for-the-badge&logo=conventionalcommits&logoColor=white" alt="Conventional Commits" />
  <img src="https://img.shields.io/badge/stack-Next.js%2016%20%7C%20Neon-111111?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js 16 | Neon" />
</p>

<p align="center">
  <a href="#overview">Overview</a> ·
  <a href="#why-this-project">Why</a> ·
  <a href="#mvp-scope">MVP scope</a> ·
  <a href="#use-cases">Use cases</a> ·
  <a href="#architecture-at-a-glance">Architecture</a> ·
  <a href="#tech-stack">Tech stack</a> ·
  <a href="#prerequisites">Prerequisites</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#project-structure">Project structure</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="#roadmap">Roadmap</a> ·
  <a href="#contributing">Contributing</a>
</p>

## Overview

Invoicey is a modern invoicing tool for Czech freelancers and small teams. It treats each invoice as **structured data first** (one Zod schema, validated everywhere) and **rendered documents second** (PDF via `@react-pdf/renderer`, ISDOC XML, SPAYD QR for bank apps).

The same payload should eventually flow through the UI builder, JSON/MCP tools, or Slack — without duplicate types or drift.

**Current phase:** Plan 1 shipped — Turborepo + Next.js 16 admin shell, Drizzle wiring, shadcn/ReUI registry, commitlint. **Next:** Plan 2 (`invoice-core`). See [Roadmap](#roadmap).

## Why this project

1. UX that feels like a 2026 finance product, not a legacy admin panel.
2. Czech VAT baked in: rates, reverse charge (přenesená daňová povinnost), OSS, DUZP, supplies abroad.
3. **ARES** lookup by IČO for issuer and client parties.
4. **SPAYD** QR so Czech banking apps pre-fill payment fields.
5. **ISDOC** export so accounting tools (Pohoda, Money S3, iDoklad, …) can import without retyping.
6. Multi–issuer-business support (invoice “from” ŽL vs s.r.o. with separate numbering and banks).

Inspired by [Midday.ai](https://midday.ai) (polish, finance UX) and [fakturaonline.cz](https://fakturaonline.cz) (Czech compliance). Differentiators: schema-first design, automation-ready surfaces (MCP/Slack on the roadmap), snapshots so historical invoices stay legally stable after registry edits.

## MVP scope

| Area | What ships |
| --- | --- |
| **Documents** | Invoice, proforma, advance, credit note — Czech VAT modes and DUZP |
| **Parties** | Multiple issuer businesses; shared client registry; ARES prefetch |
| **Numbers** | Per-issuer, per-doc-type templates (`{YYYY}{####}`, yearly reset, atomic counters) |
| **Lifecycle** | Draft → issue → paid / overdue / cancelled (status **derived**, not cron-ticked) |
| **UI** | Next.js 16, shadcn + [ReUI Data Grid](https://reui.io/components/data-grid), dashboard |
| **Exports** | PDF + embedded QR; ISDOC 6.0.2 |
| **Assets** | UploadThing for logo / stamp / signature |

Post-MVP (Plans 10–14): recurring invoices, email, MCP server, Slack bot, Clerk auth, multi-currency, bilingual PDFs. Details: [`docs/roadmap.md`](docs/roadmap.md).

## Use cases

**UC1 — Personal invoicing across issuer businesses** — Same operator invoices from ŽL or s.r.o.; each issuer has its own bank, numbering, VAT profile.

**UC2 — OBO / self-billing** — Buyer issues the invoice to the supplier; schema treats issuer and client symmetrically.

**UC3 — Slack-driven invoicing (post-MVP)** — e.g. `@Invoicey invoice NFCtron monthly standard rate` → draft aligned with `InvoiceSchema`.

Full narrative and non-goals: [`docs/PRD.md`](docs/PRD.md).

## Architecture at a glance

```mermaid
flowchart LR
    subgraph Surfaces [Input surfaces]
        UI["UI builder<br/>RHF + Zod"]
        MCP["MCP<br/>(Plan 12)"]
        Slack["Slack<br/>(Plan 13)"]
    end

    Surfaces -->|"InvoiceSchema.parse()"| SA["Server actions<br/>invoice-core + db"]
    SA -->|"snapshot at issue"| DB[("Neon Postgres")]

    SA --> PDF["renderInvoicePdf"]
    SA --> QR["renderSpaydQr"]
    SA --> ISDOC["renderIsdoc"]

    Ares["@invoicey/ares"] -.lookup.-> Surfaces
    UT["UploadThing"] -.assets.-> Surfaces
```

ADRs explain each stack choice: [`docs/decisions/README.md`](docs/decisions/README.md).

## Tech stack

| Layer | Choice |
| --- | --- |
| Repo | Turborepo + [Bun](https://bun.sh) workspaces |
| Web | Next.js 16 App Router (RSC + Server Actions) |
| UI | shadcn/ui + [ReUI](https://reui.io/docs/get-started) registry, Tailwind v4 |
| Forms | React Hook Form + `@hookform/resolvers/zod` |
| Domain | TypeScript 6 + Zod (`@invoicey/invoice-core`) |
| DB | Neon Postgres + Drizzle ORM |
| PDF / QR / ISDOC | `@react-pdf/renderer`, `qrcode`, `xmlbuilder2` |
| Files | UploadThing |
| Hosting | Vercel |

## Prerequisites

| Tool | Role |
| --- | --- |
| Git | Clone and branch |
| [Bun](https://bun.sh) ≥ 1.x | Install deps and run scripts |
| Node.js | Matches the engines declared by Next.js / ESLint |
| Neon (or any Postgres URL) | Required before `bun db:push` — copy `.env.example` to `.env.local` |

Optional for deploy: Vercel project linked to this repo (see [`docs/architecture.md`](docs/architecture.md)).

## Getting started

```bash
git clone <repository-url>
cd inveoiceyai
cp .env.example .env.local   # fill DATABASE_URL (+ optional Neon URLs)
bun install
bun dev                     # Next.js dev server (@invoicey/web)
```

Other useful scripts: `bun run build`, `bun run lint`, `bun run typecheck`, `bun db:push`.

## Project structure

```text
├── apps/
│   └── web/                     # Next.js 16 admin UI (@invoicey/web)
├── packages/
│   ├── invoice-core/            # domain layer (Plan 2+)
│   ├── db/                      # Drizzle schema + Neon client
│   ├── ares/                    # ARES REST client (Plan 4+)
│   ├── config-eslint/
│   └── config-ts/
├── docs/                        # PRD, architecture, domain, ADRs
├── turbo.json
├── package.json                 # Bun workspaces + shared tooling
├── commitlint.config.mjs
├── .env.example
└── bun.lock
```

`apps/mcp` and `apps/slack` remain roadmap-only (Plans 12–13).

## Documentation

| Doc | Purpose |
| --- | --- |
| [`docs/README.md`](docs/README.md) | Docs hub — conventions, lifecycle, ADR rules |
| [`docs/PRD.md`](docs/PRD.md) | Requirements, MVP vs non-goals, success criteria |
| [`docs/roadmap.md`](docs/roadmap.md) | Plan 0–14 goals and exit criteria |
| [`docs/architecture.md`](docs/architecture.md) | Runtime boundaries, env vars, diagrams |
| [`docs/glossary.md`](docs/glossary.md) | Czech ↔ English invoicing terms |
| [`docs/domain/invoice-schema.md`](docs/domain/invoice-schema.md) | Central Zod contract + JSON examples |
| [`docs/decisions/`](docs/decisions/README.md) | Architectural Decision Records |

Per-feature specs under [`docs/specs/`](docs/specs/README.md) and UX flows under [`docs/ui/`](docs/ui/README.md) are filled **just-in-time** before each build plan.

## Roadmap

| Phase | Goal | Status |
| --- | --- | --- |
| Plan 0 | Documentation scaffold | Done |
| Plan 1 | Monorepo bootstrap (Next.js, Drizzle, ReUI, commitlint) | Done |
| Plan 2 | `invoice-core` domain package | Next |
| Plans 3–9 | PDF stack + ARES + issuer/client UI + polish (**MVP**) | Planned |
| Plans 10–14 | Recurring, email, MCP, Slack, auth | Post-MVP |

High-level diagram:

```mermaid
flowchart LR
    P0["Plan 0<br/>docs"] --> P1["Plan 1<br/>bootstrap"]
    P1 --> P2["Plan 2<br/>invoice-core"]
    P2 --> P3["Plans 3–9<br/>MVP UI"]
    P3 -.-> Post["Post-MVP"]
```

Full table: [`docs/roadmap.md`](docs/roadmap.md).

## Contributing

1. **Docs-first:** Product and domain contracts live under [`docs/`](docs/). If behavior changes, update the relevant doc and add or supersede an ADR ([`docs/decisions/`](docs/decisions/README.md)).
2. **Commits:** Conventional commits are enforced via `commitlint` + Husky — match [`commitlint.config.mjs`](commitlint.config.mjs).
3. **Plans:** Implementation should trace to `.cursor/plans/` or equivalent tracked plans; cross-link PRs to the docs they implement.
4. **Secrets:** Never commit `.env`, API tokens, or UploadThing keys.

## License

TBD — likely permissive OSS once MVP ships.
