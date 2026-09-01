# 0039: Invoice PDFs are looks — data documents interpreted by react-pdf

## Status

Accepted (2026-08-31)

## Context

The invoice is validated data ([invoice-as-data](../../apps/web/content/docs/concepts/invoice-as-data.mdx)). The PDF is an output. Today that output is one JSX tree in `@invoicey/invoice-core` ([ADR 0004](./0004-pdf-react-pdf-renderer.md)): a single A4 layout, `customization` limited to an unused accent enum plus stamp/signature flags.

We want more than one face for the same `InvoiceSchema`: first-party **Classic** and **Minimal**, later a Pro builder, later a community catalog. “Template” and “preset” already mean other things (numbering tokens, recurring payloads, MCP/Slack data, email, role presets).

Options:

1. **More JSX files** — `InvoicePdfClassic.tsx`, `InvoicePdfMinimal.tsx`. Fast for two looks. Closes the builder and community: those surfaces would have nothing reconstructible to save.
2. **HTML + Chromium** — full CSS, a WYSIWYG canvas, “any invoice.” Reopens ADR 0004 (bundle size, cold start, golden tests) and lets a look omit DIČ / DUZP / VAT legal notes.
3. **Look documents** — a versioned JSON layout of known **blocks** in **bands**, plus a **theme**. `@react-pdf/renderer` stays. Each block is a JSX component. The same document is what we ship as Classic `1.0.0`, what the builder edits, and what we snapshot at issue.

Forces:

- Issued and imported PDF **bytes** stay the document the client already has ([ADR 0021](./0021-immutable-imported-invoice-artifacts.md), stored artifacts).
- If those bytes are missing we must regenerate the _same face_, not “whatever Classic is this week” (open TODO in [`snapshots.md`](../domain/snapshots.md)).
- A look that cannot place a legally required block is not an invoice look.
- Free applies Classic only; Pro applies the rest. Seeing a locked card is not applying.
- Community publish cannot wait on a human review queue.

## Decision

1. **Names.** Users pick a **look** (layout + default theme). An invoice may carry an **appearance override** (theme tokens and optional-block flags only). Recurring `invoice_templates` and MCP `presets` stay payload recipes.

2. **Closed composition.** A layout is a stack of bands (`stack` or two-column `row` at `1/1`, `1/2`, `2/1`). Slots are block **instances** `{ block, variant? }`. v1 blocks: `logo`, `title`, `issuer`, `client`, `dates`, `lines`, `totals`, `tax`, `payment`, `qr`, `stamp`, `signature`, `notes`, `footer`. `tax` is one polymorphic block. `payment` may appear twice as `compact` and `full`. `dates` is optional: Classic places it under the client; Minimal has no dates band — `title` still prints issue/due/DUZP. Theme tokens include `paper`, `ink`, `muted`, `line`, `accent`, type scale, density, `logoMaxHeightPt`, `stampMaxHeightPt`, and the optional-block flags. A look cannot invent a block or drop a required one. A4 only. No custom fonts, no decorative images, no x/y canvas.

3. **Renderer.** Keep `@react-pdf/renderer` ([ADR 0004](./0004-pdf-react-pdf-renderer.md) is not superseded). The JSX tree becomes the **block interpreter**, not “the look.” `renderInvoicePdf(invoice)` still returns visual PDF + embedded ISDOC; the invoice (or its look snapshot) selects the document to interpret.

4. **Snapshot.** At **issue**, persist the full look document `{ id, version, layout, theme }` with the invoice, same spirit as [ADR 0008](./0008-snapshot-issuer-client-at-issue-time.md). Issued rows with no snapshot mean Classic `1.0.0` (today’s layout encoded as data). Serve stored bytes when present. Regenerate from the snapshot, never from the live catalog. Imported artifacts remain immutable.

5. **Origins and storage.** `first_party` looks live as versioned data in the repo (Classic `1.0.0` is reviewable in PRs). `workspace` and `community` looks live in the DB. Publish is opt-in and must pass the same validator as render for every `docType` × VAT mode first-party looks support. Slugs `classic` and `minimal` are reserved.

6. **Apply vs replay.** Entitlement gates **applying** a look (workspace default, draft pick, issue). It does not gate **replaying** a snapshot (stored PDF, regenerate, credit-note copying the original face). Duplicate-as-new-draft without entitlement resets to Classic. Workspace default is a pinned id + semver, not a floating “latest.”

7. **Delivery.** Same IR throughout. Build in slices: **S0** Classic as data + snapshot + picker + Free/Pro lock on Minimal; **S1** structured + JSON builder for workspace looks; **S2** publish + community catalog. JSON and structured views edit the same schema.

Vocabulary: [`CONTEXT.md`](../../CONTEXT.md).

## Consequences

### Positive

- Classic, Minimal, a workspace look, and a community look are the same kind of document. The builder cannot drift from the renderer.
- Historical regenerate has an answer: the snapshotted look, or Classic `1.0.0`.
- Legal completeness is a validator, not a footer we inject after the fact.
- ADR 0004’s serverless/font/golden-test story stays intact.

### Negative

- Classic `1.0.0` must faithfully encode the current JSX (including the two-column header and compact payment in the party column). That is work we do not get from “add a second TSX file.”
- The block vocabulary is a product constraint. Looks that need a third column, a custom font, or a dropped `tax` block are out of scope on purpose.
- Community takedown, licensing prose, and extra first-party Pro looks are not designed here.

### Neutral

- `InvoiceCustomizationSchema` is replaced by the appearance override (theme tokens + optional blocks). `accentColor` was never applied in the renderer.
- No new permission: workspace default look is owner/admin (same as workspace name/logo); picking a look on a draft is `invoices:create`.

## Alternatives considered

**One good JSX template forever.** Rejected — it cannot become a builder or a catalog without a rewrite.

**HTML + Puppeteer for a template editor.** Rejected — we chose closed composition; Chromium is the cost of a freedom we do not want.

**Snapshot only look id + version.** Rejected — community looks can disappear and first-party versions can be retired; the blob is what we re-render, as with issuer/client.

**Integer look versions.** Rejected in favour of semver: major = layout change, minor = additive optional token/block default, patch = default theme values. Appearance overrides never bump a look version.

## Plans touched

- [Plan 27](../../.cursor/plans/plan-27-pdf-looks-s0.md) S0
- [Plan 28](../../.cursor/plans/plan-28-pdf-looks-s1.md) S1
- [Plan 29](../../.cursor/plans/plan-29-pdf-looks-s2.md) S2

## References

- [ADR 0004](./0004-pdf-react-pdf-renderer.md)
- [ADR 0008](./0008-snapshot-issuer-client-at-issue-time.md)
- [ADR 0021](./0021-immutable-imported-invoice-artifacts.md)
- [ADR 0035](./0035-plans-are-shared-entitlement-rows.md)
- [`docs/specs/pdf-rendering.md`](../specs/pdf-rendering.md)
- [`docs/domain/snapshots.md`](../domain/snapshots.md)
