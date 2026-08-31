# PDF looks S1 — workspace builder

**Plan:** 28 · **ADR:** [0039](../decisions/0039-looks-are-data-react-pdf-interprets.md) · **S0:** [pdf-looks.md](./pdf-looks.md) · **Vocabulary:** [`CONTEXT.md`](../../CONTEXT.md)

S2 (community publish) is **out of this spec**.

## Goal

A Pro workspace can save its own **workspace looks** in the database and apply them on invoices. The Pro **builder** edits the same look document the renderer already interprets: a structured view, a JSON view, and a live PDF preview. JSON is not a back door — unknown fields fail validation and do not save.

Free still applies Classic only. Workspace looks appear in the picker as locked with upgrade, same as Minimal.

## Inputs / outputs

| Name                                      | Type                         | Notes                                                                    |
| ----------------------------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| `LookDocument.origin`                     | `first_party` \| `workspace` | `community` waits for S2                                                 |
| `LookSlugSchema`                          | `^[a-z][a-z0-9-]{0,62}$`     | Document `id` for a workspace look. `classic` and `minimal` are reserved |
| `findLookDocument(id, version, extra)`    | `LookDocument \| undefined`  | First-party, then `extra` (workspace rows)                               |
| `latestLooksById(looks)`                  | `LookDocument[]`             | Highest semver per `id`                                                  |
| `bumpLookVersion(version, part)`          | semver                       | `major` / `minor` / `patch`                                              |
| `workspaceLookFrom(source, { id, name })` | `LookDocument`               | Copy a look as `origin: workspace`, version `1.0.0`                      |
| `workspace_looks`                         | table                        | One row per workspace + look id + version                                |

## Storage

```sql
workspace_looks (
  id uuid primary key,
  workspace_id text not null,
  look_id text not null,   -- LookDocument.id (slug)
  version text not null,   -- LookDocument.version
  document jsonb not null, -- full LookDocument
  created_at, updated_at
)
unique (workspace_id, look_id, version)
```

First-party looks stay in the repo. Workspace looks never overwrite `classic` / `minimal`.

Save always **inserts a new version** (does not mutate a row). Theme-only change → patch. Layout change → minor. Issued invoices keep their snapshot, so old versions remain resolvable.

## Catalog resolve

`resolveLookDocument(invoice, catalog?)`:

1. Valid `lookSnapshot` on the invoice
2. `findLookDocument(look.id, look.version, catalog)`
3. Classic `1.0.0`

`catalog` is the workspace’s stored documents, loaded at the request. The public demo PDF route does not read the table; preview payloads include `lookSnapshot` when the look is not first-party.

Issue, draft write, and new-draft inherit use the same catalog. Unknown id+version at issue is `invalid_look` (not a silent Classic). Duplicate-as-draft without entitlement still resets to Classic.

Workspace default may pin a workspace look (`id` + `version`). It does not float to latest on save.

## Builder

Route: `/settings/workspace/looks` (list) and `/settings/workspace/looks/[lookId]` (editor). Owner or admin, same gate as workspace name/logo. `looks.apply = "catalog"` to create or save. Members with catalog may **apply** a workspace look on an invoice; they do not edit looks.

Create: duplicate Classic or Minimal into a new slug + name at `1.0.0`. The editor then has three views of one document:

- **Structure** — name, theme tokens, bands (stack / row split / slots). Footer stays last. Compact only on payment.
- **JSON** — the look document. Apply runs `LookDocumentSchema` + `validateLookDocument`.
- **Preview** — `renderInvoicePdf` on the demo sample invoice with `lookSnapshot` set to the draft document.

Delete removes every version of that `look_id` in the workspace, refused while it is the workspace default. Snapshots on issued invoices do not need the row.

## Entitlements

No new entitlement. `looks.apply === "catalog"` covers applying Minimal, applying workspace looks, and using the builder. Do not branch on `plan.key`.

## Tests

- Workspace origin parses; reserved slug refused.
- `findLookDocument` prefers an extra catalog over falling back to Classic.
- Save bump: layout → minor, theme → patch.
- Draft inherit uses a workspace default when the catalog contains it.
- Issue snapshots a workspace look; missing version is `invalid_look`.

## Out of S1

Community origin, publish, extra first-party looks, custom fonts, non-A4, drag-and-drop builder polish, floating default versions.
