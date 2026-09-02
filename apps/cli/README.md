# Invoicey CLI

Interactive terminal cockpit for an Invoicey workspace.

```bash
bun run --filter=@invoicey/cli start
# or
bun apps/cli/src/bin.ts
```

```bash
invoicey login
invoicey status
invoicey invoices
invoicey invoices issue 20260012
```

Auth is a personal API key from **Settings → API keys**, same as remote MCP.
Config: `~/.invoicey/cli.json`. Docs: `/docs/integrations/cli`.
