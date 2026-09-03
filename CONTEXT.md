# Invoicey

A Czech-first invoicing product. An invoice is validated data; PDF, ISDOC, and payment QR are outputs of that data.

## Language

**Invoice**:
A validated `InvoiceSchema` value: parties, lines, VAT, payment, totals. Issued invoices are immutable historical records.
_Avoid_: Treating the PDF as the invoice.

**Look**:
A pickable catalog entry that pairs one layout with a default theme. Users select a look; they do not select a “PDF template.”
_Avoid_: Template, preset, theme (as the thing you pick), PDF template, invoice template.

**Layout**:
The reconstructible structure inside a look: a stack of **bands**. A band is a vertical stack of block instances, or a two-column row of such stacks. A layout may reorder and group blocks; it may not invent a block or drop a legally required one.
_Avoid_: Template, canvas, HTML, free-form page, a flat unique-id list (Classic is not one column).

**Band**:
One horizontal slice of a layout — either a stack or a two-column row (`1/1`, `1/2`, or `2/1`). The footer band is always last.
_Avoid_: Page, section, canvas row.

**Block instance**:
A placed block in a band slot: `{ block, variant? }`. The same block type may appear twice only when variants differ. v1 variants: `full` (default) and `compact` (payment only).
_Avoid_: Unique block ids as the whole layout.

**Theme**:
The variable visual tokens of a look. In the first cut: `paper`, `ink`, `muted`, `line`, `accent`; type scale `sm | md | lg` on Inter only; density `comfortable | compact`; bounded logo height (`logoMaxHeightPt`); bounded stamp height (`stampMaxHeightPt`); optional-block defaults (`showStamp`, `showSignature`, `showQr`, `showNotes`).
_Avoid_: Customization, branding, accent (as the whole object), arbitrary CSS, custom fonts.

**Look snapshot**:
The full look document frozen onto an invoice at issue — id, version, layout, and theme. Regeneration uses this blob, not the live catalog. Issued invoices with no snapshot mean Classic `1.0.0`.
_Avoid_: Storing only look id, re-rendering with “current Classic.”

**Look version**:
A semver on the look document. It changes when the look’s layout or default theme changes, not when an invoice applies an appearance override.
_Avoid_: Integer-only versions, git SHAs as the version.

**First-party look**:
A look Invoicey authors and ships in the catalog. Classic is usable on Free. Minimal and later first-party looks are Pro; Free can see them and is asked to upgrade.
_Avoid_: Template tier, preset pack.

**Classic**:
The first-party look that encodes today’s invoice PDF layout as data. Version `1.0.0` is that encoding. It is the only look Free may apply.
_Avoid_: Default template, the JSX file as the look, “the current template.”

**Minimal**:
The second first-party look. A different layout, not merely a denser theme of Classic. Pro-only to apply.
_Avoid_: Compact (as a third look).

**Workspace look**:
A look a Pro workspace saves from the builder and does not have to publish. Only that workspace may apply it.
_Avoid_: Preset, private template, unpublished community look (until it is published).

**Community look**:
A workspace look that was published to the catalog after passing the validator. Any Pro workspace may apply it. Publish is opt-in.
_Avoid_: Marketplace listing as the only kind of user look.

**Builder**:
The Pro editor for a look document: a structured view, a JSON view of the same schema, and a live PDF preview. It cannot emit a document outside the block vocabulary.
_Avoid_: Canvas, template editor, HTML editor.

**Appearance override**:
A per-invoice subset of theme tokens and optional-block flags. It cannot change layout or omit a required block.
_Avoid_: Custom template, forked look, per-invoice layout.

**Block**:
A named region the renderer knows how to fill from the invoice. v1: `logo`, `title`, `issuer`, `client`, `dates`, `lines`, `totals`, `tax`, `payment`, `qr`, `stamp`, `signature`, `notes`, `footer`. `logo` is optional; its bytes still come from `issuer.logoUrl`. `tax` is one block whose interior follows the invoice VAT mode. `dates` is optional: Classic places it under the client; Minimal has no dates band — `title` prints the dates. Required blocks are a function of document type and VAT mode.
_Avoid_: Widget, component, section (when you mean a typed block).

**Invoice template**:
A saved invoice _payload_ used to materialize recurring drafts. It is not a look.
_Avoid_: Using this name for PDF appearance.

**Preset**:
A saved MCP/Slack _data_ blob (`issuer` or `invoice_template`). It is not a look.
_Avoid_: Using this name for PDF appearance.

## Billing

**Workspace**:
The billable tenant. Polar's customer `external_id` is the workspace id. Plans, AI tokens, and purchased packs never follow a user across workspaces.
_Avoid_: Polar “customer” in product copy, account, org (as the billed thing).

**Plan**:
An Invoicey `plans` row. Polar products map onto a plan; they are not the plan.
_Avoid_: Polar product as the thing a workspace is “on”.

**Billing authority**:
Who may change `workspaces.plan_id`. `manual` is admin/domain/grandfathered. `polar` is a verified Polar subscription.
_Avoid_: Inferring authority from a non-null `plan_assigned_by`.

**AI tokens**:
Invoicey’s usage unit (monthly / gifted / purchased). Polar never grants Polar benefits as tokens.
_Avoid_: Credits, Polar benefits.

**Token pack**:
A one-time Polar product that credits a fixed purchased-token amount from Invoicey’s allowlist.
_Avoid_: Ad-hoc checkout prices, metadata-supplied quantities.

**Purchased-token debt**:
A negative `purchased_remaining` after a refund of tokens already spent. It blocks Invoicey-hosted AI until cleared.
_Avoid_: Clamping refunds to zero, deleting grant or usage rows.

**Polar invoice**:
The merchant-of-record receipt Polar issues to the workspace. It is not an Invoicey invoice.
_Avoid_: Invoice, faktura (for Polar’s PDF).
