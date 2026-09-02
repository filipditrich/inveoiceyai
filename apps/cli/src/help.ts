export const HELP = `Invoicey CLI — operator cockpit for your workspace.

Usage:
  invoicey                          interactive home (TTY)
  invoicey login
  invoicey logout
  invoicey whoami
  invoicey status
  invoicey invoices [ls] [--unpaid] [--limit n] [--q text]
  invoicey invoices show <ref>
  invoicey invoices new [--ico IČO] [--client id]
  invoicey invoices issue <ref>
  invoicey invoices send <ref> [--to email]
  invoicey invoices paid <ref>
  invoicey invoices unpaid <ref>
  invoicey invoices cancel <ref>
  invoicey invoices pdf <ref> [-o file]
  invoicey invoices isdoc <ref> [-o file]
  invoicey clients [ls]
  invoicey clients add <ico>
  invoicey issuers [ls]
  invoicey payments [ls]
  invoicey payments confirm <proposal-id>
  invoicey payments reject <proposal-id>
  invoicey ares <ico-or-name>

Global:
  --api <url>     override host (default https://invoicey.ditrich.me)
  --token <pat>   override saved API key
  --json          machine-readable output
  -y, --yes       skip confirmations

Auth: Settings → API keys. Config: ~/.invoicey/cli.json
Docs: https://invoicey.ditrich.me/docs/integrations/cli
`;
