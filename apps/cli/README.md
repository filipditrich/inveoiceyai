# Invoicey CLI

Interactive terminal cockpit for an Invoicey workspace.

## Install

Install the standalone release binary with one command:

```bash
curl -fsSL https://invoicey.ditrich.me/install | bash
```

The installer detects macOS or Linux and the current architecture, downloads
the matching binary, verifies it against the published SHA-256 manifest, and
installs it to `~/.invoicey/bin/invoicey`.

```bash
invoicey login
invoicey status
```

`invoicey login` asks for a personal API key from **Settings → API keys**. The
key stays in `~/.invoicey/cli.json` with mode `0600` and is never sent anywhere
except the configured Invoicey host.

### Build from this repository

From the monorepo root:

```bash
bun run invoicey:install
```

That runs `apps/cli/scripts/install.ts`:

1. `bun build --compile` of `src/bin.ts` → `apps/cli/dist/invoicey`
2. Copy to `~/.invoicey/bin/invoicey` (mode `0755`)
3. Append `export PATH="$HOME/.invoicey/bin:$PATH"` to `.zshrc` / `.bashrc` /
   fish `config.fish` when missing

Reload the shell (or `export PATH="$HOME/.invoicey/bin:$PATH"`). Re-run the
installer after pulling CLI changes. The binary embeds the Bun runtime, so the
installed command does not require Bun.

## Run from source

```bash
bun run --filter=@invoicey/cli start
# or
bun apps/cli/src/bin.ts
```

```bash
invoicey login
invoicey status
invoicey invoices issue 20260012
```

Auth is a personal API key from **Settings → API keys**, same as remote MCP.
Config: `~/.invoicey/cli.json` (mode `0600`). Docs: `/docs/integrations/cli`.
Spec: `docs/specs/invoicey-cli.md`. ADR: `docs/decisions/0044-invoicey-cli-companion.md`.
