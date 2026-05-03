# 0008: Snapshot issuer + client at issue time

## Status

Accepted (Phase 0, 2026-05-03)

## Context

Issued invoices are immutable historical records. The names, addresses, IBANs, VAT IDs they show on the rendered PDF and in their ISDOC XML are legally significant — they have to keep matching what was on the document the day it was issued, even if the underlying registry rows change later.

Storage approaches:

1. **Live FK only** — `invoices.issuer_id` references `issuer_businesses(id)`; reads always fetch the *current* state. Simplest, but breaks on every rebrand / address change.
2. **Snapshot at issue time + live FK alongside** — capture the relevant fields onto `invoices` at issue, keep the FK for history aggregation. Standard pattern in invoicing systems.
3. **Bi-temporal table for issuers** — model the issuer as a series of versions, link the invoice to the version active on the issue date. Theoretically clean but expensive in complexity (schema, migrations, queries).
4. **Append-only event log + projection** — full event sourcing; massively over-engineered for our scale and reads.

Forces:

- Invoices already on disk / sent to clients / imported into accounting tools must always match the DB
- Czech tax authorities expect static documents
- Rebrands and address changes are common, especially for sole traders relocating
- The data we need to snapshot is small (a few hundred bytes of JSON per side)

## Decision

When an invoice is **issued** (not when it's saved as a draft), the server action:

1. Loads the live `issuer_businesses` and `client_businesses` rows
2. Projects them through `IssuerSnapshotSchema` / `ClientSnapshotSchema` (defined in [`invoice-schema.md`](../domain/invoice-schema.md))
3. Persists the resulting JSON onto `invoices.issuer_snapshot` and `invoices.client_snapshot`

The full `Invoice` payload (including the snapshots) is also persisted as `invoices.payload_json` for round-tripping.

`issuer_id` and `client_id` are **kept as denormalized FK columns** on `invoices` for cheap aggregation queries ("all invoices from this issuer", "all invoices for this client").

Snapshots are **never edited after issue**. Edits to live registry rows do not touch any historical snapshot. The only correction path is **cancel + re-issue** (per [`status-engine.md`](../domain/status-engine.md)).

See [`snapshots.md`](../domain/snapshots.md) for the full operational policy, schema details, and edge cases.

## Consequences

### Positive

- Historical PDFs / ISDOCs always match the DB row → tax-authority-safe
- "Show client's name as it was at issue time" is a JSON path read — no time-travel logic
- Asset URLs (logo, stamp, signature) stored in the snapshot keep working as long as we don't delete the underlying UploadThing files (which we don't — see [ADR 0010](./0010-uploadthing-for-files.md))

### Negative

- The same name/address may appear in many snapshots; updating an issuer's address does not auto-update historical invoices (this is the *correct* behavior, but users may be surprised)
- Schema evolution of snapshots requires care — adding fields is safe, renaming/removing requires a migration with backfill
- A small amount of data duplication; trivial at our scale

### Neutral

- Snapshots are not subject to GDPR "right to erasure" gymnastics in the way live records would be — snapshots represent a legitimate historical accounting record (legal-basis exception for tax-archival). Confirm with a CPA when relevant.

## Plans touched

- Plan 2 (`invoice-core`) — defines the snapshot Zod schemas
- Plan 6 (invoice builder / issue action) — actually performs the snapshot
- Plan 5 (issuers UI) — surfaces the divergence between snapshot and live

## References

- [`snapshots.md`](../domain/snapshots.md) — full operational policy
- [`invoice-schema.md`](../domain/invoice-schema.md) — Zod schemas for `IssuerSnapshotSchema` / `ClientSnapshotSchema`
