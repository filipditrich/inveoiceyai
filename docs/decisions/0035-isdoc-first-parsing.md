# 0035 — ISDOC-first parsing, AI as an opt-in fallback

**Status:** accepted · **Date:** 2026-08-24 ·
**Spec:** [payables lifecycle](../specs/payables-lifecycle.md) §4

## Context

Plan 24 built a three-rung extraction ladder — ISDOC, ISDOC embedded in a PDF,
then AI over an arbitrary PDF — and treated all three as equivalent producers of
an invoice record. The AI rung consumes workspace tokens, produces per-field
confidence that has to be surfaced, reviewed, and second-guessed, and is the
single largest source of ongoing engineering in the capture path.

The value of the epic is in what happens _after_ an invoice is readable: the
accounting layer, the two gates, the accounting system, the payment plan. Every
hour spent making arbitrary PDF parsing better is an hour not spent there.

Czech suppliers can send ISDOC. Most invoicing software emits it. The ratio is a
number a workspace can move by asking.

## Decision

ISDOC is the supported parsing path. A document with no ISDOC — neither a
standalone file nor one embedded in a PDF — lands in `status = unsupported`,
which opens manual entry beside the document and offers a one-click
**Požádat dodavatele o ISDOC** reply.

AI parsing stays in the codebase behind a workspace switch, **off by default**.
When on, it is best-effort and its output never reaches better than
`needs_validation`.

`supplier_profiles.isdoc_ratio` tracks the share per supplier so the supplier
list can rank who costs the most manual entry.

## Consequences

**Good.** Engineering concentrates on the gates and the accounting integration.
Token spend drops to opt-in. The review screen stops being a confidence-triage
tool for most invoices. Asking suppliers for ISDOC becomes a product loop with
visible progress.

**Bad.** A workspace whose suppliers all send PDFs sees a lot of manual entry,
and will feel the product is less capable than competitors that lead with OCR.
Mitigated by the switch, by manual entry being a first-class screen rather than
an error state, and by the correction diff and supplier prefill removing most of
the typing on repeat invoices.

**Revisit when** a pilot's ISDOC ratio stays under roughly half after the
supplier-request loop has been used, at which point OCR moves from opt-in to a
funded workstream with its own plan.
