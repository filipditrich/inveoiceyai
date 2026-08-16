# Incoming invoices (přijaté faktury) — research and direction

**Status:** Promoted to [Plan 24](../../.cursor/plans/plan-24-incoming-invoices.md) ·
ADRs [0031](../decisions/0031-incoming-invoice-payable-ledger.md),
[0032](../decisions/0032-inbound-email-capture-resend.md),
[0033](../decisions/0033-fio-payment-initiation-bank-signed.md)

**Date:** 2026-08-16

Invoicey today owns one half of the money loop: it **issues** invoices, sends them,
and reconciles the **credits** that arrive on a connected bank account. The other
half — the supplier invoices a business **receives** and has to pay — is entirely
outside the product. This document is the evidence base for closing that half.

## The problem, as a Czech business actually lives it

1. Suppliers mail PDFs to whatever address they were once given.
2. Someone collects them out of a mailbox and retypes the header fields.
3. Someone decides the cost is legitimate.
4. Someone types payment orders into internet banking, once a week, from memory
   and a spreadsheet of due dates.
5. Nobody can answer "what do we owe this week, and does the balance cover it"
   without opening three tools.
6. Ten years of originals have to survive an audit.

Every step above is unstructured, and the structured artifact the whole chain
needs — an invoice record with supplier, amount, VS, due date, and beneficiary
account — is reconstructed by hand each time.

## Pattern used by every serious AP product

```text
capture → classify → extract → validate → accept → approve by rules
       → schedule payment → pay → reconcile → archive
```

Nothing in that chain is optional; products differ only in which steps they
automate and which they leave to a human. What every mature product does share:

| Capability                                  | Why it is table stakes                                        |
| ------------------------------------------- | ------------------------------------------------------------- |
| Duplicate detection before anything is paid | The same PDF arrives twice from two forwards                  |
| Supplier master keyed by IČO                | Rules, duplicates, and fraud checks need a stable key         |
| Known-beneficiary-account check             | Invoice fraud is a changed bank line on a real invoice        |
| VAT arithmetic validation                   | Cheap for structured input, catches OCR nonsense              |
| Explicit exception queue                    | Silent skips are how invoices go unpaid                       |
| Four eyes on money out                      | The paying step is never the same click as the accepting step |
| Payment calendar by due date                | The actual weekly question is "what is due"                   |
| Audit trail                                 | Who accepted, who approved, who dropped it from the run       |
| Legal archive of the original               | 10 years, unaltered                                           |

## Czech market scan

| Product                 | What it is                                                | What we take                                                                                                                                       | What we skip                                                                                                           |
| ----------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **wflow.cz**            | Process layer in front of Czech accounting systems        | Email + photo capture; AI extraction; rules by amount / partner; accountant completes coding, then managers approve                                | It stops at the accounting export. We already own the bank rail, so we do not need a second payment product bolted on. |
| **iNVOiCE FLOW**        | Intake + extraction + workflow + archive across many ERPs | One queue that unifies email / scan / PDF / ISDOC; a subset auto-approves; archive searchable by supplier / amount / date                          | Breadth of ERP connectors. Invoicey is the system of record, not a bridge to one.                                      |
| **Taxorio / Verifical** | Extraction and export                                     | The **extraction ladder**: ISDOC is exact and free, PDF-embedded ISDOC uses the XML rather than a model, only genuinely unstructured PDFs go to AI | Outsourcing extraction wholesale. We already parse ISDOC.                                                              |
| **DokladBot**           | Import specialist for one accounting system               | Nothing directly                                                                                                                                   | Single-ERP coupling                                                                                                    |
| **Fakturoid / iDoklad** | Issuer tools with a lightweight "expenses" tab            | Confirms the market shape: issuing tools grow an expense side, and users expect it                                                                 | Their expense side is a manual ledger, not a process                                                                   |

Two conclusions:

- The extraction ladder (ISDOC → embedded ISDOC → AI → manual) is the settled
  Czech answer, and Invoicey already owns two of the four rungs from Plan 15.
- Every Czech product in this space **stops at the accounting export**. None of
  them pay. Invoicey already has an encrypted bank connection, a normalized
  transaction feed, and an allocation ledger — so the pay-and-reconcile end is
  the part we can do that they structurally cannot.

## What Invoicey already has that this feature can stand on

| Existing asset                                                         | Where                                                                | How incoming invoices use it                                      |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| ISDOC 6.0.2 parser + PDF/A-3 attachment extraction                     | `@invoicey/invoice-core/isdoc` (`parseIsdoc`, `extractIsdocFromPdf`) | Rungs 1–2 of the extraction ladder, with the party roles inverted |
| ARES lookup + search                                                   | `@invoicey/ares`                                                     | Supplier master resolution and enrichment by IČO                  |
| Workspace-scoped tenancy, member roles (`member` < `admin` < `owner`)  | Better Auth organizations, ADR 0019                                  | Approvers without inventing a "teams" concept                     |
| Multiple issuers per workspace                                         | `issuer_businesses`                                                  | The receiving legal entity — no new entity table needed           |
| Encrypted bank credentials, keyed fingerprint, rotation                | `bank_connections`, `apps/web/lib/payments/token-crypto.ts`          | The Fio submit token stores identically                           |
| Normalized bank transactions with `direction` already `credit`/`debit` | `bank_transactions`                                                  | Debit ingestion is a filter change, not a schema change           |
| Deterministic, explainable matcher with reason/blocker codes           | `@invoicey/payment-core/matcher`                                     | A mirrored payables matcher for debits                            |
| Allocation ledger, reversal, projection maintenance                    | `invoice_payment_allocations`, `packages/db/src/payments-repo.ts`    | Same shape for payables                                           |
| Generic audit trail                                                    | `payment_audit_events` (action / actorType / entityType / entityId)  | No new audit table                                                |
| Resend + Svix webhook verification                                     | `apps/web/app/api/webhooks/resend/route.ts`                          | Same verification for inbound mail                                |
| UploadThing immutable artifacts + sha256 + provenance                  | Plan 15, ADR 0021                                                    | The 10-year archive of originals                                  |
| Workspace AI tokens with per-product metering                          | Plan 21, ADR 0026                                                    | AI extraction is metered, not free                                |

This is the reason the feature belongs here rather than being rebuilt: roughly
half of it already exists and is in production.

## Capture options considered

| Option                           | Mechanics                                                                                                                                                                                 | Verdict                                                                                                                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resend Inbound**               | MX record on a subdomain; Resend parses the message and POSTs an `email.received` webhook (Svix-signed) containing metadata only; body and attachments are pulled afterwards over the API | **Selected.** Resend is already the mail provider and the domain is already verified. The metadata-only webhook is exactly right for a serverless host: attachments are fetched by URL, so nothing has to squeeze through a function request body. |
| Cloudflare Email Workers         | Free routing, worker receives raw MIME                                                                                                                                                    | Rejected: adds a second vendor and a second runtime for one webhook, and we would parse MIME ourselves.                                                                                                                                            |
| Mailgun / Postmark inbound parse | Mature inbound parsing                                                                                                                                                                    | Rejected: a third email vendor alongside Resend for no capability we lack.                                                                                                                                                                         |
| Gmail / Workspace OAuth watch    | The user connects their real mailbox                                                                                                                                                      | Rejected for v1: restricted-scope OAuth verification, per-user token lifecycle, and a polling worker — a large amount of work before the first invoice appears. Revisit once alias forwarding proves too much friction.                            |

Key constraint recorded from the Resend docs: **the MX record must be on a
subdomain** (e.g. `inbox.invoicey.ditrich.me`) with the lowest priority value, so
it cannot disturb whatever mail the apex domain already handles.

## Extraction ladder

```text
1. .isdoc / .isdocx                     → deterministic, no model
2. PDF/A-3 with embedded invoice.isdoc  → deterministic, no model
3. Unstructured PDF / image             → AI proposal + per-field confidence
4. Nothing usable                       → empty form beside the document
```

Rungs 1–2 already exist in `@invoicey/invoice-core`. The mapper needs one new
direction: `parseIsdoc` currently maps an ISDOC onto an invoice **we issued**,
taking an `IssuerSnapshot`; an incoming invoice inverts the parties — the
`AccountingSupplierParty` becomes the supplier master record and the
`AccountingCustomerParty` must resolve to one of our issuers.

Rung 3 must never write a trusted record on its own. It produces a proposal with
per-field confidence that a person confirms. This is the same conclusion every
product in the scan reached, and it is also the only defensible position when the
output decides where money goes.

## Legal and retention constraints (CZ)

- **§ 35 zákona o DPH** — every VAT payer keeps tax documents for **10 years from
  the end of the tax period** they relate to. This covers received invoices,
  simplified documents, corrective documents, and payment receipts.
- **§ 35a** — electronic retention is explicitly permitted, but the
  _authenticity of origin_, _integrity of content_, and _legibility_ must be
  preserved for the whole period.

Practical consequence for the schema: the original bytes are immutable, hashed
(`sha256`), and never regenerated — which is exactly the guarantee ADR 0021
already established for imported issued invoices. A soft-deleted incoming invoice
must not delete its stored document.

## Payment initiation — what Fio actually allows

Read directly from the Fio API documentation (version 16 Oct 2025):

| Fact                           | Detail                                                                                                                                                                                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token shape                    | 64-character unique string, **valid for exactly one account**                                                                                                                                                                                                                                      |
| Token rights                   | Two settings only: _Sledování účtu_ (read/export) or _Sledování účtu a zadávání platebních a inkasních příkazů_ (read + submit orders)                                                                                                                                                             |
| Token lifetime                 | Every token must carry an expiry; **maximum 180 days**; optional auto-extension on each internet-banking login                                                                                                                                                                                     |
| Token creation                 | Requires strong authorization; on multi-signature accounts, every signatory must sign the token request; usable 5 minutes after authorization                                                                                                                                                      |
| Import endpoint                | `POST https://fioapi.fio.cz/v1/rest/import/`, `multipart/form-data` with `token`, `type` (`abo` \| `xml` \| `pain001_xml` \| `pain008_xml`), `file`, optional `lng`                                                                                                                                |
| **Authorization of the batch** | **"Po úspěšném uploadu dat se příkazy sdruží v bankovním systému do dávky, která musí být dodatečně autorizována (sms, fio podpis) oprávněnou osobou na účtu. Bez dodatečné autorizace nebudou příkazy zpracovány."**                                                                              |
| Response                       | XML with `errorCode` (`0` ok, `1` errors, `2` warnings, `11` syntax, `12` empty import, `13` file over 2 MB, `14` empty file), `idInstruction` (batch id), `status` (`ok` \| `error` \| `warning` \| `fatal`), `sumDebet`, `sumCredit`; schema at `https://www.fio.cz/schema/responseImportIB.xsd` |
| File limit                     | 2 MB                                                                                                                                                                                                                                                                                               |
| Order ordering                 | Within one XML file the order types must appear as **domestic → europlatba (T2) → foreign**, or the file is rejected                                                                                                                                                                               |
| Throttle                       | Minimum 30 seconds between calls on the same token, read or write; `409` otherwise. `500` means a missing or inactive token.                                                                                                                                                                       |
| History                        | Data older than 90 days needs a temporary unlock in internet banking, valid 10 minutes                                                                                                                                                                                                             |

The highlighted row is the single most important finding in this document.
**Invoicey physically cannot move money.** The best it can do is deposit a batch
into the customer's own "orders to sign" queue, which their own signatory then
authorizes with SMS or Fio podpis. That converts payment initiation from a
frightening capability into a labour-saving one, and it is what makes shipping
this end of the loop defensible at all.

The XML import schema is `https://www.fio.cz/schema/importIB.xsd`, with three
order elements: `DomesticTransaction`, `T2Transaction` (SEPA europlatba), and
`ForeignTransaction`. Domestic covers CZK within Czech banks and any currency
between Fio accounts; element order inside each transaction is strict.

## Scope boundaries taken

**In:** capture (mail alias + upload), classification, extraction ladder,
supplier master with known bank accounts, accept gate, rule-driven approval,
payable calendar, payment runs, Fio batch submission, debit reconciliation
against payables, 10-year archive, audit trail.

**Out, deliberately:**

| Not doing                                       | Why                                                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Purchase orders / three-way match               | Nobody in the target segment runs purchasing that way                                                                  |
| Becoming a general ledger or filing DPH returns | Adjacent product; the record we keep is exportable, that is enough                                                     |
| Auto-paying without a human                     | Structurally impossible on Fio, and undesirable anyway                                                                 |
| Card or virtual-card payout                     | The bank rail we have is a transfer rail                                                                               |
| Supplier self-service portal                    | A mailbox is the interface suppliers already use                                                                       |
| Datová schránka / Peppol / EDI intake           | Real, but each is its own project                                                                                      |
| Cost centres, budgets, budget-vs-actual         | Cash due against balance answers the question people actually ask                                                      |
| MCP / Eve agent tooling for the payable side    | Mirrors the Plan 15 decision that import is web-only; a mis-sent payment order is not an acceptable agent failure mode |

## References

- [Fio API Bankovnictví (PDF, v. 16. 10. 2025)](https://www.fio.cz/docs/cz/API_Bankovnictvi.pdf)
- [Fio import XSD](https://www.fio.cz/schema/importIB.xsd) ·
  [import response XSD](https://www.fio.cz/schema/responseImportIB.xsd)
- [Resend — receiving emails](https://resend.com/docs/dashboard/receiving/introduction)
- [Resend — Inbound announcement](https://resend.com/blog/inbound-emails)
- [ISDOC 6.0.2](https://isdoc.cz/6.0.2/)
- [§ 35 a § 35a zákona o DPH — uchovávání daňových dokladů](https://www.fakturoid.cz/almanach/legislativa/jak-archivovat-dokumenty)
- [Payment ledger and bank integration research](./payment-ledger-bank-integration.md)
