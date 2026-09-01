# Research: Invoicey CLI

**Status:** Direction selected for Plan 31
**Researched:** 2026-09-01
**Related:** [macos-archive-app.md](./macos-archive-app.md), [invoicey-drive.md](../specs/invoicey-drive.md)

## Verdict

Yes — an interactive terminal CLI belongs as a companion, **if it is an operator
cockpit**, not a port of the website.

Invoicey Drive is a Finder replica of issued PDFs. The CLI is the other missing
surface: day-to-day **management** (list, show, draft, issue, send, match
payments, clients, ARES) from a terminal, using the same schema and the same
workspace the web, MCP, and Slack already share.

Do not clone Settings, the look builder, bulk import, or members.

## Why this is a product, not an alias of MCP

MCP is for assistants. A person in a terminal should not speak JSON-RPC, should
not paste tool names, and should not read `{ content: [{ type: "text" }] }`.

The CLI is for the operator:

- `invoicey` opens a menu with workspace status.
- `invoicey invoices` lists the grid they already know.
- `invoicey invoices issue 20260012` is a named action with a confirm.
- `invoicey invoices new` is a wizard that still validates `InvoiceSchema`.

MCP stays the assistant path. The CLI stays the human path. Both hit the same
handlers.

## Auth

Reuse **Settings → API keys** (the same PAT MCP uses). Drive pairing (PKCE +
device token) is for a native Mac install that needs a device list and revoke.
A CLI already has a secret store (`~/.invoicey/cli.json`, mode `0600`) and an
env override (`INVOICEY_API_KEY`). Pasting a PAT is the product path, not a
toy — it is the machine-auth Invoicey already shipped.

Do not invent a second key type.

## Where it lives

`apps/cli` in this monorepo. It is TypeScript talking HTTP. Unlike Invoicey
Drive, it has a reason to sit next to `@invoicey/web`: shared docs, one PR,
one release train. The CLI process itself does **not** import `@invoicey/db`.
It is a remote client of `https://invoicey.ditrich.me`, same class as a Mac
app talking `/api/drive/*`.

## Alternatives rejected

**Wrap `/api/mcp` as the CLI transport.** Rejected: MCP envelopes are for
models. A person-facing client wants JSON `{ ok, error }` and binary PDF GET.

**Give the CLI `DATABASE_URL`.** Rejected: that is an internal admin tool, not
a companion product.

**Port the look builder / members / bank connect.** Rejected: those need the
website (OAuth, uploads, bank portals). The CLI manages invoices, parties, and
payment proposals.

## Suggested play sequence

1. Companion JSON API (`POST /api/companion`) + PAT gate + PDF/ISDOC GET.
2. `apps/cli`: login, status, invoices, clients, issuers, payments, ARES.
3. Interactive home when stdin is a TTY and no subcommand is given.
4. Public docs under `/docs/integrations/cli`.
