# 0037 — Pohoda XML is the reference rail; mPohoda REST is a limited option

**Status:** accepted · **Date:** 2026-08-24 ·
**Spec:** [Pohoda integration](../specs/pohoda-integration.md)

## Context

The obvious choice for a SaaS is the cloud REST API: OAuth, JSON, no customer
infrastructure. So mPohoda's OpenAPI document and POHODA's published XSD schemas
were both read before choosing.

The mPohoda REST API cannot express this epic:

- `CreateReceivedInvoiceDto` has **no předkontace field** and **no členění DPH
  field**; mPohoda derives both from its own settings.
- `Liquidate/Standalone/Fully` and `…/Partially` exist for `IssuedInvoices` and
  `IssuedAdvanceInvoices` **only**. There is no received-invoice equivalent, and
  `ReceivedInvoiceDto` exposes no payment state, so G5 can be neither written nor
  read.
- It requires the mPohoda **Pro** tier.

Pohoda XML carries `inv:accounting`, `inv:classificationVAT`, `inv:centre`,
`inv:activity` and `inv:contract` on both the header and every line, and
settles invoices through the Bank agenda's `bankLiquidationItem`. It is the only
rail that can do what §5 through §9 of the lifecycle spec require.

Its cost is transport: mServer is a desktop process bound to one accounting unit,
processing requests serially, and most customers will not expose it to the
internet.

## Decision

**Pohoda XML is the reference rail.** One dataPack builder serves three
transports:

| Rail          | Transport                                      | Ships |
| ------------- | ---------------------------------------------- | ----- |
| `xml_file`    | Generated dataPack, imported by the accountant | first |
| `xml_mserver` | POST to mServer                                | next  |
| `mpohoda_api` | REST, limitations shown in settings            | last  |

`xml_file` ships first because it needs no customer infrastructure and therefore
works for the pilot on day one. `mpohoda_api` is offered only to workspaces that
do not require předkontace control, with its limitations stated in the
connection screen rather than discovered later.

Documents are identified across the boundary by `inv:extId` carrying our invoice
UUID, which gives idempotent re-export on every XML rail.

## Consequences

**Good.** Full accounting fidelity including per-line dimensions. Likvidace is
possible. One builder, tested once against golden files, serves all three
transports. The pilot is unblocked without asking NFCtron to expose a desktop
service.

**Bad.** We own Windows-1250 encoding, schema-length truncation, and
`<rsp:responsePack>` parsing. `xml_file` needs a human to complete the loop, so
`accounting_state` advances on their confirmation rather than on a callback.
mServer's serial processing means export throughput is bounded per customer.

**Note.** `inv:liquidation` is export-only but _readable_, so a later enhancement
can detect settlement performed outside Invoicey by exporting the invoice back.
Out of scope here, recorded so the analysis is not repeated.
