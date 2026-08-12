# Invoicey — Product Requirements

## Vision

A modern, Czech-first invoicing tool that treats invoices as **structured data first** and **rendered documents second**. Built so that the same invoice can be created via a UI, a JSON document, an MCP tool, or a Slack command — all going through one schema, one validator, one renderer.

Inspired by [Midday.ai](https://midday.ai) (UX polish, finance-grade feel) and [fakturaonline.cz](https://fakturaonline.cz) (Czech tax compliance, ARES integration). Differentiated by: schema-first architecture, MCP/Slack automation as first-class create surfaces (local MCP + Slack demo already ship), multi-issuer-business support without a "company switcher" footgun.

## Use cases

The product targets three concrete scenarios. Every feature must serve at least one of them. If a proposed feature serves none, it goes into "Out of scope" until proven otherwise.

### UC1 — Personal invoicing across multiple issuer businesses

> "I invoice 2–3 clients each month. Sometimes from my freelance trade license (ŽL), sometimes from my s.r.o. Each entity has its own bank account, numbering scheme, and possibly a different VAT registration status."

- Multiple issuer businesses (the "from" side) live under one account
- Each issuer has independent: name/IČO/DIČ, address, bank/IBAN, logo, optional stamp/signature, VAT-payer flag, numbering scheme(s)
- Picking the issuer when creating an invoice drives every default downstream (bank, VAT mode, language defaults, numbering)
- Client registry is shared across issuers — the same NFCtron looks the same whether invoiced from issuer A or B

### UC2 — OBO (on-behalf-of) / self-billing

> "Sometimes I issue an invoice in the name of _my client_ to _myself_ (self-billing model — the buyer issues the invoice). The document is legally identical to a normal invoice, but the issuer is the client and the recipient is me."

- "Issuer" and "client" are symmetric concepts at schema level — both are `BusinessEntity` rows; an invoice picks one of each
- Any saved business entity (whether normally an issuer or a client) can play either role
- The numbering scheme used belongs to whoever is the issuer on the document — even if that's the legal client of the underlying service

### UC3 — AI / Slack / MCP-driven invoicing

> "I want to type `@Invoicey invoice NFCtron monthly…` in Slack, or prompt Cursor via MCP, and get a validated Czech invoice PDF — without fighting a 40-control form."

- Schema is the contract: Slack and MCP assemble the same `InvoiceSchema` the UI will use
- **Shipped:** local MCP create/render + presets ([Plan 12a](./roadmap.md#plan-12a--mcp-server-local--vercel-http-prep-appsmcp)); Eve Slack agent + Neon drafts/HITL ([Plan 13b](./roadmap.md#plan-13b--eve-slack-agent-db-backed-in-appsweb), [`specs/slack-eve.md`](./specs/slack-eve.md)); Plan 13a slash demo is historical
- **Later:** MCP+DB tool expansion (Plan 12b); workspace membership via Clerk (Plan 14)
- MVP UI remains single-user no-auth; `workspace_id` is the seam for multi-user later

## In-scope (MVP)

The MVP cut, ordered roughly by user-facing importance:

### Invoice generation

- Document types: invoice, proforma, advance (zálohová faktura), credit note (dobropis)
- Predefined PDF template, customizable: logo, optional stamp, optional signature, accent color (limited palette)
- SPAYD QR code on invoice PDF (Czech bank payment QR)
- ISDOC 6.0.2 XML download per invoice
- Full Czech VAT compliance:
  - Rates: 21 % (standard), 12 % (reduced), 0 % (selected items / exempt)
  - VAT modes: regular, reverse charge (přenesená daňová povinnost), OSS
  - Supplies abroad flag: none / EU / non-EU
  - DUZP (datum uskutečnění zdanitelného plnění) as a first-class field
- Variable / constant / specific symbol fields on every invoice
- Configurable numbering schemes per issuer per document type with template tokens

### Business management

- Issuer registry (my businesses) — VAT settings, banking, numbering schemes, logo / stamp / signature uploads
- Client registry (saved customers) — populated via ARES lookup or manual entry
- ARES (Czech business registry) lookup by IČO populating name, address, DIČ where available

### Invoice management

- Data grid (ReUI Data Grid) — sortable, filterable, paginated invoice list
- Filters: status, issuer, client, date range, free-text
- Row actions: open, download PDF, download ISDOC, duplicate (as draft), mark paid, delete (drafts only)
- Status engine: draft / issued / paid / overdue / cancelled (derived, not stored)

### Dashboard

- Counts by status (draft, issued, paid, overdue, upcoming due in N days)
- Total amounts paid / outstanding / overdue (CZK)
- Recent invoices list
- (Anything more elaborate is post-MVP)

### File uploads

- UploadThing-backed uploads for issuer logo / stamp / signature
- Allowed: PNG, JPG, SVG; size cap defined in [`specs/uploads.md`](./specs/uploads.md) when written

## Out of scope (MVP)

These are explicitly deferred. They are _not_ prohibited future work — they're just not part of the MVP cut. Each has a placeholder in the roadmap.

| Capability                                           | Why deferred                                                                                           | Where it lands        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------- |
| Recurring invoices / scheduled issuance              | Needs cron + tracking + lifecycle UI                                                                   | Plan 10               |
| Email delivery to clients                            | Needs Resend wiring + bounce handling + audit trail                                                    | Plan 11               |
| MCP + DB (list/mark paid, durable presets)           | Local MCP already ships; persistence next                                                              | Plan 12b              |
| Slack bot (DB-persisted drafts)                      | Eve agent in `apps/web/agent` ([slack-eve.md](./specs/slack-eve.md))                                   | Plan 13b              |
| Authentication / multi-user                          | Single user is enough for personal use; Clerk integrates cleanly later                                 | Plan 14               |
| Multi-currency (EUR, USD)                            | CZK-only is sufficient for the personal use case; ARES is CZ-only anyway                               | Post-MVP              |
| Dual-label bilingual invoice PDF (CS+EN on one page) | Per-invoice `cs` \| `en` covers foreign clients ([ADR 0028](./decisions/0028-per-invoice-language.md)) | Post-MVP              |
| Accounting export (Pohoda, Money S3, iDoklad)        | ISDOC already covers most importers — see [TODO below](#todoplan-3-isdoc-compatibility)                | Validate after Plan 3 |
| Bank-statement import / payment matching             | Out of scope for an invoice-issuance tool                                                              | Possibly never        |
| Client-side payment portal (pay-by-link)             | Out of scope for this product                                                                          | Possibly never        |
| Advanced templates (custom PDF layouts)              | One good template is better than ten mediocre ones                                                     | Post-MVP              |
| Tax reporting / kontrolní hlášení / DPH přiznání     | Adjacent product; ISDOC export covers the upstream piece                                               | Possibly never        |

## Success criteria (MVP)

You should be able to:

1. Add yourself as an issuer business with bank info and numbering scheme in under 2 minutes
2. Add a client by typing their IČO, hitting Lookup, and confirming the prefilled form
3. Create an invoice from scratch in under 60 seconds (one issuer, one client, one line item, full preview)
4. Download a PDF that any Czech bank scans correctly via QR
5. Download an ISDOC XML that validates against the public schema
6. See a dashboard that tells you at-a-glance how much you're owed
7. Filter and find any historical invoice in under 5 seconds via the data grid

## Open product questions

These are tracked here and resolved in domain docs. Each is tagged with the plan that resolves it.

### TODO(plan-3): ISDOC compatibility

We target ISDOC **6.0.2** (current). Verify a generated XML imports cleanly into at least one of: Pohoda, Money S3, iDoklad. If a real-world importer needs additional fields beyond the spec minimum, we add them and write a new ADR.

### TODO(plan-5): logo / stamp / signature optionality

Should the **Issue** action (which finalizes a draft and assigns a number) refuse to run without a logo on the issuer? Current default: **all three are optional** at issue time. Reconsidered when the issuer detail page lands.

### TODO(plan-3): PDF font for Czech diacritics

Inter, Roboto, and IBM Plex Sans all ship with Latin Extended-A coverage. Pick one and pin the version. Decision lands in `specs/pdf-rendering.md`.

### TODO(plan-2): legacy 15 % / 10 % VAT rates

We target invoices issued **today** (rates 21 % / 12 % / 0 %). If a user enters a backdated invoice (DUZP in 2023) where 15 % / 10 % applied, do we (a) reject, (b) allow custom rate, (c) preset historical rates per DUZP year? Current default: **(b) allow custom positive percentage** — see [`domain/vat-czech.md`](./domain/vat-czech.md). Revisit if it surfaces issues.

## Glossary check

Every domain term used here is also defined in [`glossary.md`](./glossary.md): IČO, DIČ, DUZP, VS/KS/SS, ISDOC, SPAYD, plátce DPH, přenesená daňová povinnost, OSS, dobropis, zálohová faktura, ŽL, s.r.o.
