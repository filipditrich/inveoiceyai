# 0036 — A provider-neutral accounting dimension layer

**Status:** accepted · **Date:** 2026-08-24 ·
**Spec:** [accounting layer](../specs/accounting-layer.md)

## Context

An incoming invoice cannot be booked from its own contents. Someone has to say
which předkontace, which středisko, which činnost, which členění DPH, and on
which date it is booked. Today that person retypes the whole invoice into POHODA
to say it.

Two shapes were available. Model the dimensions as POHODA fields, which is fast
and matches the first integration exactly. Or model them as generic codelists
that a provider adapter consumes, which costs one indirection.

POHODA's own model — a header value with a per-line override, over five
codelists — is not idiosyncratic. It is roughly how Money S3, ABRA, Helios and
iDoklad all express the same idea, because it is how Czech double-entry
accounting works.

## Decision

Five dimensions — `predkontace`, `centre`, `activity`, `contract`,
`vat_classification` — modelled as generic codelists in
`accounting_codelists` / `accounting_codelist_items`, plus two header dates
(`tax_date`, `accounting_date`).

Each dimension resolves per line through a fixed six-level chain: line override,
header value, automation prefill, supplier default, workspace default, empty.
Line inheritance is **rendered, not copied** — a line with no override displays
the header value and follows it when it changes.

A provider adapter declares which dimensions it consumes and how they map. Codes
are Invoicey's; `external_id` carries the provider's.

## Consequences

**Good.** The second accounting integration is an adapter, not a schema change.
Codelist values can be synced, imported, or typed, so a workspace is never
blocked on an integration being reachable. Learned supplier defaults sit
naturally in the chain and remove most repeat typing.

**Bad.** One indirection between what the accountant picks and what POHODA
receives, and a mapping table to keep correct. A dimension a future provider
needs and we do not model requires a migration after all.

**Rejected:** storing raw POHODA codes on the invoice. It would have shipped a
week sooner and made every subsequent integration a rewrite of the G1 screen.
