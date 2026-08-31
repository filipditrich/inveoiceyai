# PDF looks S2 — community publish

**Plan:** 29 · **ADR:** [0039](../decisions/0039-looks-are-data-react-pdf-interprets.md) · **S0:** [pdf-looks.md](./pdf-looks.md) · **S1:** [pdf-looks-builder.md](./pdf-looks-builder.md) · **Vocabulary:** [`CONTEXT.md`](../../CONTEXT.md)

Takedown tooling and licensing prose are **out of this spec** (ADR 0039).

## Goal

A Pro workspace can **publish** a workspace look into a global **community** catalog. Any Pro workspace may apply a published community look. Publish is opt-in and must pass the same structural validator plus the transfer payment rule. There is no human review queue.

Free still applies Classic only. Community looks appear in the picker as locked with upgrade, same as Minimal.

## Inputs / outputs

| Name                        | Type                 | Notes                                                                                         |
| --------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| `LookDocument.origin`       | includes `community` | Same document as first-party and workspace                                                    |
| `communityLookFrom(source)` | `LookDocument`       | Copy a workspace look as `origin: community` (same id, version, name)                         |
| `lookIsPublishable(look)`   | issues[]             | `validateLookDocument` plus a payment block (the only invoice-dependent rule today)           |
| `looksForPicker(extra)`     | `LookDocument[]`     | First-party + workspace latest + published community latest; workspace id wins over community |
| `community_looks`           | table                | One row per community look id + version                                                       |

## Storage

```sql
community_looks (
  id uuid primary key,
  look_id text not null,
  version text not null,
  document jsonb not null,           -- LookDocument with origin community
  publisher_workspace_id text not null,
  unpublished_at timestamptz null,
  created_at, updated_at
)
unique (look_id, version)
```

The first insert of a `look_id` owns that slug. Another workspace publishing the same slug is `community_slug_taken`. The publisher may insert further versions.

Unpublish sets `unpublished_at`. It does not delete the row. Re-publish of the same version clears `unpublished_at`.

## Publish

Owner or admin, `looks.apply = "catalog"`, same gate as the builder. Source is the **saved** workspace look currently in the editor (refuse if dirty / unsaved). `communityLookFrom` + `lookIsPublishable` must pass.

The workspace look stays `origin: workspace`. Other workspaces see the community copy. The author’s picker lists the workspace look, not a duplicate community card for the same id.

## Catalog resolve

`loadWorkspaceLookContext.catalog` is workspace rows plus **published** community documents. `findLookDocument` / issue / default pin use that catalog. Unpublished community looks are absent, so a draft still pointing at one cannot issue (`invalid_look`) until the user picks another look. Issued invoices keep `lookSnapshot`.

## Entitlements

No new entitlement. `looks.apply === "catalog"` covers applying and publishing community looks. Do not branch on `plan.key`.

## Tests

- Community origin parses; `communityLookFrom` refuses first-party and reserved ids.
- `lookIsPublishable` refuses a look without payment.
- Picker lists a published community look and hides it when the current workspace already has that id.
- Issue snapshots a community look; unpublished version is `invalid_look`.

## Out of S2

Moderation queue, takedown console, licensing copy, extra first-party looks, custom fonts, non-A4, floating default versions.

## References

- [ADR 0039](../decisions/0039-looks-are-data-react-pdf-interprets.md)
- [pdf-looks-builder.md](./pdf-looks-builder.md)
