# 0049: A second, DOM interpreter renders looks for editing; react-pdf still owns the output

## Status

Accepted (2026-09-03)

## Context

Today the invoice builder is a form beside an iframe. The form posts
`InvoiceSchema` to a render endpoint, `@react-pdf/renderer` returns bytes, and
the browser displays a PDF. It works, and it feels like filling in a database
row while a document watches from the next column.

What converts a visitor on a free invoice generator is the opposite feeling:
typing _on the invoice_. Clicking the supplier block and typing the company
name there. Adding a line by pressing enter at the end of the last one. The
document responding under the cursor rather than a beat later in a neighbouring
frame.

A PDF in an iframe cannot do this. Producing that feeling requires a second
renderer — one that interprets the same look document
([ADR 0039](./0039-looks-are-data-react-pdf-interprets.md)) into DOM, with the
fields editable in place.

ADR 0039 rejected HTML rendering, but it rejected it _as the output_: Chromium
in the serverless path, and a freedom (arbitrary CSS) that lets a look omit a
legally required block. Neither objection applies to an HTML surface used only
for editing, where the PDF remains the artifact and the block vocabulary remains
closed.

The real cost is duplication. Every block would exist twice: once in react-pdf
primitives, once in DOM. Two implementations of one visual specification drift,
and drift here is worse than cosmetic — a visitor who types on a page and then
downloads a visibly different document loses precisely the trust the feature
exists to build.

## Decision

1. **Two interpreters, one look document.** The **PDF interpreter**
   (`@react-pdf/renderer`) remains the sole producer of the artifact: it renders
   what gets downloaded, mailed, stored, and regenerated. The **DOM interpreter**
   renders the same `LookDocument` — same bands, same block instances, same
   theme — into an editable page. The PDF is the truth; the DOM view is an
   editing surface that happens to look like it.

2. **A renderer-neutral style IR.** `createInvoicePdfStyles(theme)` currently
   derives react-pdf styles from theme tokens. It is refactored to emit a
   neutral style intermediate representation that both interpreters consume, so
   spacing, type scale, density, and colour are computed once. Neither
   interpreter carries private layout constants.

3. **Coverage is a type error, not a bug report.** Both interpreters implement
   the same block map keyed by the closed block vocabulary. A block present in
   one and missing from the other fails to compile; a test asserts both maps
   cover every block for every `docType` × VAT mode combination that the PDF
   validator accepts.

4. **Exact pixel parity is explicitly not promised.** Inter rendered by a
   browser and Inter embedded by react-pdf differ in metrics, and chasing that
   is unbounded work for no user benefit. What is promised is structural parity:
   same blocks, same order, same bands, same theme values. Screenshot diffing
   with a tolerance may be added later to catch structural regressions; it is
   not a launch requirement.

5. **Editing happens on the page; computation does not.** Parties, dates, title,
   notes, and line-item rows (including add and remove) are edited inline. The
   `totals` and `tax` blocks are never editable — they are computed from the
   line items, and a document where a user can type over the VAT total is not an
   invoice. Settings that are not text on the page — VAT mode, currency,
   document language, colours — live in a side panel.

6. **Classic first, free generator first.** The DOM interpreter ships for
   **Classic** only, on the public free invoice generator, where the feeling is
   worth the most. The in-app builder keeps its form until one look has proved
   the approach; Minimal and workspace looks follow only if it does.

7. **The DOM interpreter never issues.** Validation, totals, numbering, and
   issue remain server-side against `InvoiceSchema`. The editable page is an
   input device.

## Consequences

### Positive

- The free generator can offer a genuine "typing on the invoice" experience
  without reopening the serverless, font, and golden-test tradeoffs of ADR 0004.
- The style IR removes the duplicated layout constants that would otherwise be
  the first thing to drift.
- A block added to the vocabulary cannot be half-implemented.

### Negative

- Every future block costs two implementations. That is a permanent tax on the
  block vocabulary, accepted deliberately and scoped by shipping Classic only.
- Line-item editing in DOM is genuinely fiddly work — row VAT, keyboard
  behaviour, validation — and it is the part of the surface users touch most.
- Two renderers means two places a visual bug can live, and the reported one
  will usually be the wrong one.

### Neutral

- ADR 0039 is extended, not superseded: looks remain data, composition remains
  closed, react-pdf remains the interpreter _of record_.
- The existing PDF preview component stays useful — it is how a user confirms
  the final artifact before downloading.

## Alternatives considered

**Bind the existing form to the existing PDF preview** (click a region to focus
a field, highlight blocks on focus, refresh in place). Rejected as the primary
answer — it is cheap and safe, but it produces a better form next to a document,
not the sense of writing on the document. It remains the fallback if the DOM
interpreter proves too costly to maintain.

**Full WYSIWYG canvas with no form at all.** Rejected — VAT modes, currency,
document language, and validation need a real control surface, and hiding them
on a canvas trades comprehension for spectacle.

**Render the DOM view from the PDF** (pdf.js, a text layer over the canvas).
Rejected — it inverts the dependency, ties editing latency to a server render,
and makes text editing a hit-testing problem.

**Accept drift; treat the DOM view as approximate.** Rejected as a starting
position — the whole purpose is to demonstrate that our output is trustworthy.

## References

- [ADR 0004](./0004-pdf-react-pdf-renderer.md) — react-pdf for output
- [ADR 0039](./0039-looks-are-data-react-pdf-interprets.md) — looks are data
- [ADR 0048](./0048-guest-issuance-into-unclaimed-workspaces.md) — guest issuance
- [`docs/specs/pdf-looks.md`](../specs/pdf-looks.md)
- [`docs/specs/free-invoice-generator.md`](../specs/free-invoice-generator.md)
