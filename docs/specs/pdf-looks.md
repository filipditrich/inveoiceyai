# PDF looks (S0)

**Plan:** 27 · **ADR:** [0039](../decisions/0039-looks-are-data-react-pdf-interprets.md) · **Vocabulary:** [`CONTEXT.md`](../../CONTEXT.md)

S1 (builder) and S2 (community publish) are **out of this spec**. They consume the same look document.

## Goal

Replace the single hardcoded invoice PDF with a **look document**: a versioned JSON layout of known blocks in bands, plus a theme. Ship **Classic `1.0.0`** (today’s layout as data) and **Minimal `1.0.0`** (a second layout). Snapshot the full look at issue. Free may apply Classic only; Pro (and any plan with `looks.apply = "catalog"`) may apply Minimal. Free still **sees** Minimal as a locked upgrade card.

The PDF remains an output of `InvoiceSchema`. ISDOC is unchanged.

## Inputs / outputs

| Name                                    | Type                  | Notes                                              |
| --------------------------------------- | --------------------- | -------------------------------------------------- |
| `LookDocument`                          | Zod                   | id, semver, origin, name, layout, theme            |
| `AppearanceOverride`                    | Zod                   | optional theme token + optional-block subset       |
| `resolveLookDocument(invoice)`          | `LookDocument`        | snapshot → catalog → Classic `1.0.0`               |
| `validateLookDocument(look)`            | issues[]              | structure, variants, required blocks, footer last  |
| `validateLookForInvoice(look, invoice)` | issues[]              | required blocks for this docType / VAT / payment   |
| `canApplyLook(apply, lookId)`           | boolean               | Classic always; others need `catalog`              |
| `renderInvoicePdf(invoice)`             | `Promise<Uint8Array>` | unchanged public API; interprets the resolved look |

## Look document

```ts
const LOOK_BLOCKS = [
  "logo",
  "title",
  "issuer",
  "client",
  "dates",
  "lines",
  "totals",
  "tax",
  "payment",
  "qr",
  "stamp",
  "signature",
  "notes",
  "footer",
] as const;

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Semver = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);

const LookThemeSchema = z.object({
  paper: HexColor,
  ink: HexColor,
  muted: HexColor,
  line: HexColor,
  accent: HexColor,
  typeScale: z.enum(["sm", "md", "lg"]),
  density: z.enum(["comfortable", "compact"]),
  logoMaxHeightPt: z.number().min(24).max(96),
  stampMaxHeightPt: z.number().min(24).max(200).default(88),
  showStamp: z.boolean(),
  showSignature: z.boolean(),
  showQr: z.boolean(),
  showNotes: z.boolean(),
});

const BlockInstanceSchema = z.object({
  block: z.enum(LOOK_BLOCKS),
  variant: z.enum(["full", "compact"]).optional(), // default full
});

const BandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stack"),
    slots: z.array(BlockInstanceSchema).min(1),
  }),
  z.object({
    type: z.literal("row"),
    split: z.enum(["1/1", "1/2", "2/1"]).default("1/1"),
    start: z.array(BlockInstanceSchema).min(1),
    end: z.array(BlockInstanceSchema).min(1),
  }),
  z.object({
    type: z.literal("footer"),
    slots: z.tuple([z.object({ block: z.literal("footer") })]),
  }),
]);

const LookDocumentSchema = z.object({
  id: z.string().min(1).max(64),
  version: Semver,
  origin: z.enum(["first_party"]), // S1 adds workspace; S2 adds community
  name: z.string().min(1).max(80),
  layout: z.object({ bands: z.array(BandSchema).min(1) }),
  theme: LookThemeSchema,
});
```

### Structural validator (publish / first-party load)

- Exactly one `footer` band, and it is last.
- `compact` is allowed only on `payment`.
- The same `{ block, variant }` pair appears at most once.
- The same block type appears twice only when variants differ.
- Always-required blocks are placed: `title`, `issuer`, `client`, `lines`, `totals`, `tax`, `footer`.
- Page is A4 (not in the document; the renderer does not read a page size).

### Invoice validator (render / issue)

| Block                                                           | Required when                                                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `title`, `issuer`, `client`, `lines`, `totals`, `tax`, `footer` | always                                                                                                     |
| `payment` (`full` or `compact`)                                 | `payment.method === "transfer"`; otherwise the full payment block still renders the method label if placed |
| `logo`, `qr`, `stamp`, `signature`, `notes`, `dates`            | optional; omitted or empty if data / theme flags / SPAYD do not apply                                      |

Refuse render/issue when a required block is missing. Do **not** inject blocks.

`tax` is one block. Interior is selected by the invoice: VAT recap, non-payer sentence, reverse-charge note, or OSS note.

`title` owns doc label, number, and the credit-note reference. Issue date, due date, and DUZP (when `docType` is `invoice` or `credit_note`) live in the `dates` block when that block is placed; otherwise `title` still prints them so Minimal and older looks keep a complete header. Classic `1.0.0` places `dates` under the client, aligned with compact payment under the issuer.

`payment` `compact`: account number, variable symbol, method. `full`: current payment details, including `instructionsBefore` / `instructionsAfter`. QR is a separate block.

Empty optional blocks collapse (no reserved gap). A row column that becomes empty collapses; the sibling takes full width.

## First-party catalog (S0)

Repo data in `@invoicey/invoice-core`, not the database. Slugs `classic` and `minimal` are reserved.

**Classic `1.0.0`** — today’s face encoded as bands:

1. `row` `1/1`: start `[logo]` · end `[title]`
2. `row` `1/1`: start `[issuer, payment compact]` · end `[client, dates]`
3. `stack`: `[lines, totals, tax]`
4. `row` `1/1`: start `[qr]` · end `[payment full]`
5. `stack`: `[notes]`
6. `row` `1/1`: start `[signature]` · end `[stamp]`
7. `footer`

Theme matches the current hardcoded colours (`paper` `#ffffff`, `ink` `#0a0a0a`, `muted` `#4b5563`, `line` `#e5e7eb`, `accent` `#0a0a0a`), `typeScale: md`, `density: comfortable`, `logoMaxHeightPt: 52`, `stampMaxHeightPt: 154` (1.75× the 88pt default), optional-block flags `true`.

**Minimal `1.0.0`** — different structure, not a denser Classic:

1. `stack`: `[title]`
2. `row` `1/1`: start `[logo, issuer]` · end `[client]`
3. `stack`: `[lines, totals, tax]`
4. `row` `2/1`: start `[payment full]` · end `[qr]`
5. `stack`: `[notes]`
6. `row` `1/1`: start `[stamp]` · end `[signature]`
7. `footer`

Theme: `accent` `#2563eb`, `typeScale: sm`, `density: compact`, `logoMaxHeightPt: 40`, `stampMaxHeightPt: 88`. No compact payment.

`getFirstPartyLook(id, version)` returns the document or `undefined`. Unknown version does not silently float to latest.

## Invoice payload

```ts
look: z.object({ id: z.string(), version: z.string() }).optional();
appearance: AppearanceOverrideSchema.optional();
lookSnapshot: LookDocumentSchema.optional();
customization: InvoiceCustomizationSchema.optional(); // parse-only compat
```

`AppearanceOverrideSchema` is a partial `LookThemeSchema` (every key optional).

On parse:

- Missing `look` → treat as `{ id: "classic", version: "1.0.0" }` at **resolve** time, not by mutating the payload.
- `customization` without `appearance`: map `showStamp` / `showSignature`; map `accentColor` enum to hex (`neutral` `#0a0a0a`, `blue` `#2563eb`, `green` `#16a34a`, `amber` `#d97706`, `rose` `#e11d48`, `violet` `#7c3aed`).
- `lookSnapshot` is ignored on draft **writes**; issue overwrites it from the catalog.

Drafts store `look: { id, version }` only. Issued payloads store that plus `lookSnapshot` (full document).

## Resolve / render

```
lookSnapshot valid? → use it
else catalog.get(look.id, look.version)? → use it
else Classic 1.0.0
```

Then merge `appearance` over `theme` (override wins per present key). Then `validateLookForInvoice`. Failure → do not render (draft preview shows the error; issue returns `invalid_look`).

`@react-pdf/renderer` interprets bands. Each block is a JSX component. Theme drives colours, type scale, density, logo max height. Stamp/signature/QR/notes honour the merged theme flags **and** available assets / notes / SPAYD.

Public API `renderInvoicePdf(invoice)` does not change. Draft payloads have no `lookSnapshot`. Callers that render a draft (web preview, MCP, Slack, draft download) copy the catalog document onto a transient snapshot via `withLookSnapshotForRender` so the renderer stays a single-argument API. Do not run that helper on issued invoices: a missing snapshot there means Classic `1.0.0`, not the live catalog.

## Persistence

**Workspace** (pinned default, not floating):

- `default_look_id` text NOT NULL DEFAULT `'classic'`
- `default_look_version` text NOT NULL DEFAULT `'1.0.0'`

Owner/admin may change it (`workspace:manage` is still dissolve-only; same gate as workspace name/logo: owner or admin). Setting a look the workspace cannot apply is rejected.

**Invoice row:** look lives in `payload_json`. Optional denormalized `look_id` / `look_version` for issued rows (nullable; drafts may set them too).

**Issue** (`issueInvoiceById`):

1. Resolve catalog document for `payload.look` (default Classic `1.0.0`).
2. `canApplyLook` must pass for this workspace.
3. `validateLookForInvoice`.
4. Write `lookSnapshot` into `payload_json`.
5. Render + persist artifacts as today.

Issued invoices with **no** snapshot mean Classic `1.0.0` (regenerate path). Imported `artifacts_immutable` still never regenerate.

**New drafts** inherit the workspace default look at creation (UI, MCP, Slack, recurring materialize). Recurring `invoice_templates` stay payload recipes and do not pin a look in S0.

**Duplicate-as-draft:** drop `lookSnapshot`; if the workspace cannot apply the source look, reset to Classic `1.0.0` (do not copy a Pro look onto Free). Credit-note **replay** of an issued original’s snapshot is out of S0 (credit notes are ordinary drafts with a picked look).

**Downgrade:** do not rewrite drafts. **Issue** refuses a look the workspace cannot apply (`look_not_entitled`). Preview of a locked look is allowed as a watermarked/upsell state in the picker, not as the issued face.

## Entitlements

Do not branch on `plan.key`.

```ts
looks: z.object({
  apply: z.enum(["classic", "catalog"]),
});
```

|               | Free      | Pro       | Enterprise | NFCtron   |
| ------------- | --------- | --------- | ---------- | --------- |
| `looks.apply` | `classic` | `catalog` | `catalog`  | `catalog` |

`canApplyLook("classic", id)` is true only for `classic`. `catalog` may apply every first-party look.

Existing `plans.entitlements` rows must be backfilled in SQL before `EntitlementsSchema` requires `looks` (strict parse).

## UI (S0)

- Invoice builder: look picker listing Classic (always selectable) and Minimal (selectable or locked with upgrade). Hidden fields `lookId` / `lookVersion`. Appearance knobs: optional-block toggles + accent (hex from a small palette matching the old enum). Live PDF preview uses the selected look.
- Workspace settings: default look picker, same lock rules, owner/admin only.
- Catalog copy must say **look**, never template/preset.

## Tests

- Look document Zod + structural validator (Classic/Minimal parse; bad footer/compact/duplicate instances fail).
- `validateLookForInvoice` for regular / reverse_charge / non-payer / proforma / cash.
- `resolveLookDocument`: snapshot wins; missing snapshot → Classic `1.0.0`; unknown id → Classic `1.0.0`.
- `canApplyLook` matrix.
- `renderInvoicePdf` still embeds ISDOC; Classic and Minimal both produce `%PDF` for the domestic fixture.
- Entitlements merge includes `looks`.
- Issue refuses `look_not_entitled` (unit or ops test if a seam exists).

## Out of S0

Builder, JSON editor, workspace/community origins, publish, duplicate-look-as-workspace-look, community catalog, extra first-party looks, custom fonts, non-A4, floating default versions.

## References

- [ADR 0039](../decisions/0039-looks-are-data-react-pdf-interprets.md)
- [ADR 0004](../decisions/0004-pdf-react-pdf-renderer.md)
- [ADR 0008](../decisions/0008-snapshot-issuer-client-at-issue-time.md)
- [pdf-rendering.md](./pdf-rendering.md)
- [plans-entitlements.md](./plans-entitlements.md)
