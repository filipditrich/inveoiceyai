# Plan 31 — Invoicey CLI

**Status:** in progress
**ADR:** [0044](../../docs/decisions/0044-invoicey-cli-companion.md)
**Spec:** [invoicey-cli.md](../../docs/specs/invoicey-cli.md)
**Research:** [invoicey-cli.md](../../docs/research/invoicey-cli.md)

## Goal

Ship an interactive terminal CLI that manages invoices, clients, issuers,
payments, and ARES against the live workspace, authenticated with the same PAT
as remote MCP.

## Order

1. `@invoicey/invoice-tools` companion ops + request schema + ref lookup + tests
2. `POST /api/companion` + PDF/ISDOC GET, PAT via `resolveMachineBearer`
3. `apps/cli` — config, client, commands, interactive home
4. Public docs, README, architecture, API-keys mention

## Out of 31

Look builder, import, members, bank connect, recurring editor, Drive tokens,
local database mode.
