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
  workspaces ||--o{ invoice_templates : has
  workspaces ||--o{ recurring_schedules : has
  workspaces ||--o{ presets : has
  issuer_businesses ||--o{ invoices : from
  clients ||--o{ invoices : to
  issuer_businesses ||--o{ invoice_templates : from
  clients ||--o{ invoice_templates : to
  invoice_templates ||--o| recurring_schedules : schedule
  recurring_schedules ||--o{ invoices : drafts
  issuer_businesses ||--o{ issuer_numbering_schemes : has
  invoices ||--o{ invoice_items : has
  workspaces ||--o{ email_messages : has
  invoices ||--o{ email_messages : optional
  email_messages ||--o{ email_events : has
  workspaces ||--o{ email_suppressions : has

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
    jsonb email_settings
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
    text pdf_url
    text isdoc_url
    timestamptz pdf_generated_at
    uuid recurring_schedule_id FK
  }

  invoice_templates {
    uuid id PK
    text workspace_id
    uuid issuer_id FK
    uuid client_id FK
    text name
    text doc_type
    int payment_due_days
    jsonb payload_json
  }

  recurring_schedules {
    uuid id PK
    text workspace_id
    uuid template_id FK
    text cadence
    int day_of_month
    text next_run_on
    int paused
    text last_run_on
    uuid last_invoice_id
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

  email_messages {
    uuid id PK
    text workspace_id
    uuid invoice_id FK
    text template
    text to_email
    text status
    text provider_message_id
  }

  email_events {
    uuid id PK
    uuid message_id FK
    text type
    text provider_event_id
  }

  email_suppressions {
    uuid id PK
    text workspace_id
    text email
    text reason
  }
```

## Tables

| Table                      | Notes                                                                                                                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspaces`               | Seeded default UUID workspace                                                                                                                                                                                                                                  |
| `issuer_businesses`        | Live issuer; snapshot is IssuerSnapshot JSON (ADR 0008); `email_settings` jsonb (Plan 11)                                                                                                                                                                      |
| `issuer_numbering_schemes` | Per `(issuer, docType)`; `counter` / `reset_period` / `padding` (numbering.md)                                                                                                                                                                                 |
| `clients`                  | Plan 4                                                                                                                                                                                                                                                         |
| `invoices`                 | Drafts: `number` + `issued_at` null; unique `(issuer_id, number)`. Issued artifacts: `pdf_url`, `isdoc_url`, `pdf_generated_at`. Import provenance: `origin_*`, `import_completeness`, `import_batch_id`, `imported_at`, `external_key`, `artifacts_immutable` |
| `invoice_items`            | Denormalized lines; canonical lines also in `payload_json`                                                                                                                                                                                                     |
| `invoice_import_batches`   | Bulk import run counters / defaults                                                                                                                                                                                                                            |
| `presets`                  | MCP/Slack `issuer` \| `invoice_template`; unique `(workspace_id, kind, name)`                                                                                                                                                                                  |
| `email_messages`           | One row per send; Resend id + latest delivery status (Plan 11)                                                                                                                                                                                                 |
| `email_events`             | Append-only webhook events; unique `provider_event_id`                                                                                                                                                                                                         |
| `email_suppressions`       | Bounce/complaint suppressions for automated sends (Plan 11d)                                                                                                                                                                                                   |

## Backend selection (presets)

| Condition                                          | Store                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL` set and no `path` override          | Neon `presets`                                                   |
| `INVOICEY_PRESETS_BACKEND=file` or explicit `path` | JSON file (`INVOICEY_PRESETS_PATH` / `~/.invoicey/presets.json`) |

`create_invoice` (MCP) persists a draft invoice row when `DATABASE_URL` is set.

## References

- ADR 0007 workspace-scoped data, 0008 snapshots, 0009 Neon+Drizzle, 0014 derived status
- Schema: [`packages/db/src/schema.ts`](../../packages/db/src/schema.ts)
