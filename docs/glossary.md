# Glossary

Czech tax / invoicing / business-registration terms with English equivalents and short definitions. When in doubt about a term used elsewhere in the docs, look here first.

Sorted by Czech name (or original abbreviation).

## Identification & registration

### IČO

**Identifikační číslo osoby** — the 8-digit "company ID" assigned by the Czech statistical office to every economic entity (companies, sole traders, NGOs). The primary key for ARES lookups. Sometimes written `IČ`.

> Example: `28288390`

### DIČ

**Daňové identifikační číslo** — VAT identification number. For Czech entities the format is `CZ` + the IČO (or, for natural persons, `CZ` + birth number). An entity has a DIČ only if it's registered as a _plátce DPH_ or _identifikovaná osoba_. Used as the VAT ID in invoices.

> Example: `CZ28288390`

### ARES

**Administrativní registr ekonomických subjektů** — Ministry of Finance public registry of all economic entities. We use its REST API (`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}`) to look up businesses by IČO. See [`specs/ares.md`](./specs/ares.md) (written before Plan 4).

### ŽL

**Živnostenský list** — trade license. Colloquial shorthand for being a self-employed sole trader (OSVČ) under one of several trade categories. Such a person has an IČO but is taxed as a natural person.

### s.r.o.

**Společnost s ručením omezeným** — limited liability company. Most common Czech legal form for small companies. Has its own IČO + DIČ.

### a.s.

**Akciová společnost** — joint-stock company. Less common at our scale; mentioned for completeness.

### OSVČ

**Osoba samostatně výdělečně činná** — self-employed person. Umbrella term covering ŽL holders and other self-employed categories.

## VAT (DPH) terminology

### DPH

**Daň z přidané hodnoty** — value-added tax. Czech rates as of 2026: 21 % (standard), 12 % (reduced), 0 % (selected items, mainly books). See [`domain/vat-czech.md`](./domain/vat-czech.md).

### Plátce DPH

**VAT payer** — an entity registered for VAT, required to charge VAT on outputs and entitled to deduct VAT on inputs. Mandatory above ~2 M CZK turnover/year (threshold may shift). Has a DIČ. Issues invoices with VAT lines.

### Neplátce DPH

**Non-VAT-payer** — entity below the threshold (or not registered). Issues simpler invoices without VAT lines. May still have a DIČ if they're an _identifikovaná osoba_ (see below).

### Identifikovaná osoba

**Identified person (for VAT)** — a non-VAT-payer that has been assigned a DIČ for limited cross-border transactions (typically intra-EU services). They do not charge VAT on domestic invoices but their DIČ appears on cross-border ones. Out of scope for our default UI; the VAT-payer flag covers the common case.

### DUZP

**Datum uskutečnění zdanitelného plnění** — date of taxable supply. The legally significant date for VAT purposes — typically the date the service was rendered or the goods delivered. Often coincides with the issue date but can differ. Mandatory on every Czech invoice that has VAT lines. See [`domain/vat-czech.md`](./domain/vat-czech.md).

### Přenesená daňová povinnost

**Reverse-charge mechanism** — for certain B2B Czech services (construction, scrap, …) and most cross-border B2B EU services, VAT is accounted for by the _recipient_, not the supplier. The invoice shows a 0 amount in the VAT column and a legal note like "Daň odvede zákazník dle § 92a zákona o DPH". Modeled as `vat.mode = 'reverse_charge'`.

### OSS

**One-Stop Shop** — EU-wide simplification for B2C cross-border digital/services/goods supplies. The supplier charges the _destination_ country's VAT rate but reports it via a single OSS return in their home country. Modeled as `vat.mode = 'oss'`. Out of MVP UX scope but the schema accommodates it.

### VIES

**VAT Information Exchange System** — EU service for verifying that a foreign DIČ is valid. ARES does not authoritatively report Czech VAT-payer status (see [`specs/ares.md`](./specs/ares.md) — written before Plan 4). VIES is the canonical source for cross-border DIČ validation. Not used in MVP.

## Payment fields

### VS

**Variabilní symbol** — variable symbol. A numeric code (up to 10 digits) used by the payer in a Czech bank transfer to identify which invoice they're paying. Almost always equal to the invoice number's numeric part. Critical for payment-to-invoice matching.

### KS

**Konstantní symbol** — constant symbol. A 4-digit code categorizing the payment type. `0308` is the standard for invoice payments. Mostly legacy.

### SS

**Specifický symbol** — specific symbol. Optional, payer-defined further identifier. Rarely used.

### IBAN

**International Bank Account Number** — the standardized international form of a bank account number. Format for CZ: `CZ` + 2 check digits + 4-digit bank code + 6-digit prefix + 10-digit account number. Required field in SPAYD QR.

> Example: `CZ65 0800 0000 1920 0014 5399`

### BIC / SWIFT

**Bank Identifier Code** — 8 or 11-char identifier of the recipient bank. Optional alongside IBAN in SPAYD; we omit by default.

### SPAYD

**Short Payment Descriptor** — Czech Banking Association standard for QR-code bank-payment encoding. Format starts with `SPD*1.0*` followed by `KEY:VALUE` pairs separated by `*`. See [`specs/spayd-qr.md`](./specs/spayd-qr.md) (written before Plan 3) and the [Wikipedia article](https://en.wikipedia.org/wiki/Short_Payment_Descriptor).

> Example: `SPD*1.0*ACC:CZ6508000000192000145399*AM:12500.00*CC:CZK*X-VS:2026001*MSG:Faktura 2026001`

### Fio (Fio banka)

Czech bank with a self-service **monitoring token** and proprietary JSON periods API. Plan 22's first read-only bank adapter — see [`specs/payment-ledger-fio.md`](./specs/payment-ledger-fio.md) and [ADR 0029](./decisions/0029-payment-ledger-fio-first.md).

### MONETA Money Bank

Czech bank with an account-holder **API token** (VIP AISP) for balances and transaction history. Plan 23's second read-only adapter — see [`specs/payment-ledger-moneta.md`](./specs/payment-ledger-moneta.md) and [ADR 0030](./decisions/0030-moneta-second-adapter.md). Tokens expire within ~90 days; history is capped at 90 days.

### Payment ledger

Workspace-scoped store of normalized bank transactions, match **proposals**, and confirmed **allocations**. Allocations are the payment source of truth; `invoices.paid_at` / `paid_amount` / `payment_state` are projections. Manual mark-paid and bank confirms (Fio / MONETA) share the same path.

### Allocation

A confirmed payment fact linking money (manual or bank transaction) to an invoice for a positive amount. Reversals keep history; they do not delete rows.

## Document terminology

### Faktura

**Invoice** — the primary document. In our schema: `docType = 'invoice'`.

### Zálohová faktura

**Advance invoice** / **proforma for an advance payment** — request for an advance payment before the work is done. Not a tax document on its own; the corresponding tax document is a _daňový doklad k přijaté platbě_ issued after the advance is received. We model this as `docType = 'advance'` and (post-MVP) generate the follow-up tax document automatically.

### Proforma

**Proforma invoice** — a non-tax document used as a payment request. Similar to _zálohová faktura_ in everyday speech but with subtler legal differences. Modeled as `docType = 'proforma'`.

### Dobropis

**Credit note** — a document that reduces a previously-issued invoice (e.g. partial refund, returned goods, billing error). Has its own number; references the original invoice. Modeled as `docType = 'credit_note'`.

### Daňový doklad

**Tax document** — a document with full VAT particulars (issuer DIČ, recipient DIČ if applicable, DUZP, VAT breakdown). A _faktura_ issued by a _plátce DPH_ is automatically a _daňový doklad_. A _faktura_ issued by a _neplátce_ is not; Invoicey must not print „DAŇOVÝ DOKLAD“ or a 0 % DPH column on it.

### Číslo faktury

**Invoice number** — the issuer's sequential identifier for the invoice. We generate it via per-issuer numbering schemes — see [`domain/numbering.md`](./domain/numbering.md).

### Přijatá faktura

### Dodavatel

**Supplier / vendor** — the counterparty on a _přijatá faktura_, keyed by IČO. Distinct from a _client_ (the counterparty on an invoice we issue), even when the same company fills both roles.

### Příkazy k podpisu

## Standards & file formats

### ISDOC

**Information System Document** — a Czech XML standard for electronic invoicing, maintained by [SPIS](https://www.spis.cz/) (currently version 6.0.2). Most Czech accounting tools (Pohoda, Money S3, iDoklad, …) can import ISDOC. We export every invoice as ISDOC alongside the PDF. See [`specs/isdoc.md`](./specs/isdoc.md) (written before Plan 3).

### ISDOCX

ISDOC packaged together with attachments (typically the PDF rendering of the same invoice) in a single zip-like container. Out of MVP scope; we ship the XML and PDF separately for now.

### CNB

**Česká národní banka** — Czech National Bank. Source of official daily exchange rates. Not used in CZK-only MVP; future multi-currency work will hit `https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/`.

## Product entities

### Workspace

A Better Auth **organization** (ADR 0019). The tenancy boundary for invoices, issuers, and members. In Invoicey Drive the workspace display name is the first folder under the Drive root. Identity is `workspace_id`, not the folder title.

_Avoid:_ account, tenant, org (in user-facing copy)

### Issuer

**Issuer business** — a legal entity the workspace invoices _from_ (`issuer_businesses`). Has its own name, IČO, bank, numbering, and VAT settings. In Invoicey Drive the live issuer name is the second folder. Identity is `issuer_id`.

_Avoid:_ company (when you mean this row), account

### Filename template

Issuer email/download setting (`filenameTemplate`). Tokens such as `{kind}` and `{number}` produce a **single file stem** for PDF/ISDOC attachments. Slashes are stripped. Not the Drive layout.

### Drive layout template

User-owned path under `/{workspace}/{issuer}/`. Stored on `drive_user_settings` with `include_isdoc` and hidden workspace ids. Slashes create folders. Default `{year}/{kind}_{number}`. Must contain `{number}` or `{name}`. `{name}` is an alias of `{kind}_{number}`. `{year}` is the issue-date year in Europe/Prague. Distinct from the issuer filename template.

## Invoicey Drive

### Invoicey Drive

macOS companion: a Finder **Locations** domain (File Provider) plus a menu-bar librarian. It shows issued invoice files. It is a **replica** of UploadThing artifacts, not a second Invoicey and not Proton Drive.

See [`specs/invoicey-drive.md`](./specs/invoicey-drive.md), [ADR 0041](./decisions/0041-invoicey-drive-companion.md).

_Avoid:_ Invoicey.app, Mac Invoicey, Proton Drive (the analogue, not the product)

### Drive device

One paired Mac install owned by a **user**. Listed and revocable in Settings → Invoicey Drive. Identity is `drive_devices.id`.

### Drive device token

Long-lived secret for `/api/drive/*` only. Stored in the Mac Keychain. Not a Settings PAT, not the env ops key, not a browser session cookie.

### Mirror folder

Optional security-scoped folder on the Mac (iCloud Drive, Proton Drive, `_faktury`, …) that receives the same relative tree as Invoicey Drive. The File Provider domain is Invoicey Drive; this folder is an extra copy.

## Automation surfaces

### MCP

**Model Context Protocol** — open protocol from Anthropic for exposing tools and resources to LLM clients (Cursor, Claude Desktop, …). [Plan 12a](./roadmap.md#plan-12a--mcp-server-local--vercel-http-prep-appsmcp) ships `apps/mcp` (stdio) + `apps/web` `/api/mcp` over `@invoicey/invoice-tools` / `@invoicey/invoice-core` (+ ARES). Plan 12b adds DB-backed tools. Spec: [`specs/mcp.md`](./specs/mcp.md).

### invoice-tools

**`@invoicey/invoice-tools`** — shared package for draft normalize, ARES lookup, create/render (PDF + ISDOC), file-backed presets, and MCP tool registration (`@invoicey/invoice-tools/mcp`). Used by `apps/mcp` and Slack AI wrappers in `apps/web`.

### Slack slash command

Slack's `/command argument…` syntax. The user types it in any channel; Slack POSTs an `application/x-www-form-urlencoded` body (`command`, `text`, `user_id`, `team_id`, `channel_id`, `response_url`) to a configured URL and expects a `200` within **3 seconds**. We use `/invoice <free-text>` for the Plan 13a demo bot — see [`specs/slack-bot.md`](./specs/slack-bot.md).

### `response_url`

The webhook URL Slack provides on every slash-command and interactive payload. Our worker POSTs to it after the initial 3-second ack to deliver the real result (or a follow-up failure message) without holding the original HTTP connection open.

### AI SDK

[Vercel AI SDK](https://ai-sdk.dev/) — TypeScript SDK that abstracts LLM providers behind one `generateText` / `streamText` API and provides first-class tool calling via `tool({ description, parameters: ZodSchema, execute })`. Web `/api/ai/invoice` and Eve use the Gateway model string; Plan 13a’s hand-rolled loop was retired.

### AI Gateway

[Vercel AI Gateway](https://vercel.com/docs/ai-gateway) — provider-agnostic router with one API key (`AI_GATEWAY_API_KEY`) that forwards to OpenAI / Anthropic / Google / etc. Lets us swap models via env (`INVOICEY_AI_MODEL`) without code changes.

### Workspace AI tokens

Entitlement unit for Invoicey-hosted LLM usage (ADR 0026). Buckets: gifted / monthly / purchased; products: web, slack, mcp (activity). See [ai-usage.md](./specs/ai-usage.md).

### Tool calling

Pattern where an LLM is given typed function descriptions and replies with structured calls instead of free text. The model emits `{ name, arguments }`; the runtime executes the function and feeds the result back into the conversation. We rely on this so the LLM never invents IDs, totals, or ISDOC XML — it only picks fields and asks our deterministic functions to compute / render.

## Other terms

### Splatnost

**Due date** — the date by which payment is expected. Standard Czech business term is 14 days, but 30 is also common.

### Účetní doklad

**Accounting document** — any document that triggers an accounting entry (invoice, receipt, cash voucher, internal voucher, …). Wider category than _daňový doklad_.

### Konsolidovaný balíček

**Consolidation Package** — the 2024 Czech tax reform that, among other things, merged the 15 % and 10 % VAT rates into a single 12 % reduced rate. The reason our supported rates are 21 % / 12 % / 0 % rather than the older 21 % / 15 % / 10 %.
