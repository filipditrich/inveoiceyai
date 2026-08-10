# Database schema — durable foundation

## Goal

Neon Postgres tables for workspaces, issuer businesses, clients, invoices, invoice items, and MCP/Slack presets. Single-tenant via `INVOICEY_DEFAULT_WORKSPACE_ID` (default `00000000-0000-4000-8000-000000000001`) until Plan 14 (Clerk).

Package entry points:

- `@invoicey/db` — schema, transactions, preset/invoice repos, `tryCreateDbFromEnv`
- `@invoicey/db/client` — eager `db` with `@invoicey/env` validation (Next.js)

## ERD

```mermaid
erDiagram
  workspaces ||--o{ issuer_businesses : has
  workspaces ||--o{ clients : has
  workspaces ||--o{ invoices : has
  workspaces ||--o{ presets : has
  issuer_businesses ||--o{ invoices : from
  clients ||--o{ invoices : to
  issuer_businesses ||--o{ issuer_numbering_schemes : has
  invoices ||--o{ invoice_items : has

  workspaces {
    text id PK
    text name
    timestamptz created_at
  }

  issuer_businesses {
    uuid id PK
    text workspace_id
    text source
    jsonb snapshot
    timestamptz created_at
    timestamptz updated_at
  }

  issuer_numbering_schemes {
    uuid id PK
    text workspace_id
    uuid issuer_id FK
    text doc_type
    text template
    text reset_period
    int counter
    int counter_year
    int padding
  }

  clients {
    uuid id PK
    text workspace_id
    text source
    jsonb snapshot
    timestamptz created_at
    timestamptz updated_at
  }

  invoices {
    uuid id PK
    text workspace_id
    uuid issuer_id FK
    uuid client_id FK
    text doc_type
    text number
    text issue_date
    text due_date
    text duzp
    timestamptz issued_at
    timestamptz paid_at
    timestamptz cancelled_at
    numeric total
    numeric subtotal
    numeric vat_total
    text client_name
    jsonb payload_json
  }

  invoice_items {
    uuid id PK
    uuid invoice_id FK
    int position
    text description
  }

  presets {
    uuid id PK
    text workspace_id
    text kind
    text name
    jsonb data
  }
```

## Tables

| Table | Notes |
| --- | --- |
| `workspaces` | Seeded default UUID workspace |
| `issuer_businesses` | Live issuer; snapshot is IssuerSnapshot JSON (ADR 0008) |
| `issuer_numbering_schemes` | Per `(issuer, docType)`; `counter` / `reset_period` / `padding` (numbering.md) |
| `clients` | Plan 4 |
| `invoices` | Drafts: `number` + `issued_at` null; unique `(issuer_id, number)` |
| `invoice_items` | Denormalized lines; canonical lines also in `payload_json` |
| `presets` | MCP/Slack `issuer` \| `invoice_template`; unique `(workspace_id, kind, name)` |

## Backend selection (presets)

| Condition | Store |
| --- | --- |
| `DATABASE_URL` set and no `path` override | Neon `presets` |
| `INVOICEY_PRESETS_BACKEND=file` or explicit `path` | JSON file (`INVOICEY_PRESETS_PATH` / `~/.invoicey/presets.json`) |

`create_invoice` (MCP) persists a draft invoice row when `DATABASE_URL` is set.

## References

- ADR 0007 workspace-scoped data, 0008 snapshots, 0009 Neon+Drizzle, 0014 derived status
- Schema: [`packages/db/src/schema.ts`](../../packages/db/src/schema.ts)
