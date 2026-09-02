# 0044: Invoicey CLI is a PAT-authenticated operator companion

## Status

Accepted (2026-09-01)

## Context

Create-from-anywhere already has three surfaces: web, MCP, Slack. Invoicey Drive
is a fourth, but it is a **file replica** — it must not create, issue, or pay
([ADR 0041](./0041-invoicey-drive-companion.md)).

Operators who live in a terminal still bounce to the website for the daily
loop: who is unpaid, issue this draft, send, confirm a Fio match, add a client
by IČO. MCP can do some of that, but it is an assistant protocol. Wrapping it
as a human CLI would leak JSON-RPC and tool envelopes into the product.

Server Actions remain the website mutation surface ([ADR 0016](./0016-server-actions-as-mutation-surface.md)).
MCP and Slack already call `@invoicey/invoice-tools` from route handlers. A
CLI needs the same handlers behind a machine-auth HTTP API.

## Decision

1. Ship **Invoicey CLI** (`apps/cli`, binary `invoicey`) as a companion product:
   an interactive terminal cockpit for invoice, client, issuer, payment, and
   ARES management. The website stays the system of record and the place for
   looks, members, bank connect, bulk import, and account security.
2. Authenticate with the existing **user PAT or ops `MCP_API_KEY`**, same verify
   order as `/api/mcp` ([ADR 0023](./0023-account-security-soft-devices.md)).
   Store the PAT in `~/.invoicey/cli.json` (mode `0600`) or `INVOICEY_API_KEY`.
   Do not reuse Drive device tokens.
3. Expose a **companion JSON API** at `POST /api/companion` (discriminated `op`)
   plus `GET /api/companion/invoices/:ref/pdf|isdoc`. Handlers live in
   `@invoicey/invoice-tools` and run under the same ALS workspace as MCP.
   Invoice refs are a UUID **or** an issued `number`.
4. The CLI is a remote HTTP client. It does not open Neon. Default host is
   `https://invoicey.ditrich.me`.
5. Irreversible actions (issue, send, mark paid, cancel, confirm/reject a
   match) confirm in a TTY unless `--yes` is passed.
6. Ship `invoicey` as a **Bun-compiled standalone binary** into
   `~/.invoicey/bin`, installed from the repo with `bun run invoicey:install`.
   A public `curl | bash` page is out of v1; the installer stays in-tree.
7. `POST /api/companion` always returns a JSON object
   (`{ ok: true, ... }` or `{ ok: false, error }`). Handlers must not leak
   Next.js HTML error pages. The CLI does not follow redirects and surfaces
   non-JSON bodies instead of swallowing them.

## Consequences

- `/api/invoices/[id]/pdf` stays cookie-session for the website. CLI downloads
  go through `/api/companion/...`, parallel to Drive's `/api/drive/...`.
- A future native client that wants management (not files) can reuse the
  companion API instead of MCP.
- Entitlements and issuer lock stay server-side. The CLI cannot invent an
  issuer; `create` injects the workspace default the same way MCP does.
- The compiled binary embeds the Bun runtime (tens of MB). Re-run
  `bun run invoicey:install` after pulling CLI changes. Config stays in
  `~/.invoicey/cli.json`; the binary lives in `~/.invoicey/bin/invoicey`.

## Alternatives rejected

**MCP as the CLI transport.** Rejected: wrong envelope for a human product.

**Drive-style PKCE pairing.** Rejected for v1: the CLI is a PAT client like
Cursor, not a Mac install that needs a device roster.

**`apps/cli` as a sibling repo.** Rejected: it is TypeScript in the same
release train; Drive left the monorepo because Xcode does not.

## Plans touched

- Plan 31 (Invoicey CLI)

## References

- [`specs/invoicey-cli.md`](../specs/invoicey-cli.md)
- [`research/invoicey-cli.md`](../research/invoicey-cli.md)
- [`specs/mcp.md`](../specs/mcp.md)
- [`specs/account-security.md`](../specs/account-security.md)
