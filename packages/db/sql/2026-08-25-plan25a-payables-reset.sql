-- Plan 25a — payables lifecycle foundations
--
-- DESTRUCTIVE. Drops every Plan 24 payables table and lets `bun db:push`
-- recreate them from `packages/db/src/incoming-schema.ts` in the Plan 25 shape.
--
-- Authorised 2026-08-25: the payables domain carries no production-grade data,
-- so a reset is cheaper and safer than a rename migration. The issued side
-- (invoices, clients, issuers, workspaces, auth, bank_connections,
-- bank_transactions, invoice_payment_allocations) is NOT touched.
--
-- What changes in the schema:
--   * status vocabulary: needs_review → needs_validation, extract_failed →
--     unsupported, accepted → validated, plus new `parsing` and `in_validation`
--   * accepted_at / accepted_by_user_id → validated_at / validated_by_user_id
--   * new `accounting_state` projection (ADR 0038) and `accounting_date`
--   * new correction chain: supersedes_id, superseded_by_id, correction_round
--
-- Procedure:
--   1. Confirm the payables tables are disposable:
--        bun run --cwd packages/db scripts/row-counts.ts
--   2. Run this file.
--   3. bun db:push          -- recreates the tables from the Drizzle schema
--   4. bun run --cwd packages/db scripts/seed-incoming-invoices.ts   (optional)
--   5. bun run --cwd apps/web check:runtime-schema
--
-- Re-running is a no-op once step 3 has been done, because the DROPs use
-- IF EXISTS and db:push is idempotent. Do NOT run step 2 twice without step 3.

BEGIN;

-- Children first, though CASCADE would cover it; explicit order documents the
-- dependency graph for anyone reading this later.
DROP TABLE IF EXISTS payable_match_proposals CASCADE;
DROP TABLE IF EXISTS payable_payment_allocations CASCADE;
DROP TABLE IF EXISTS payment_run_lines CASCADE;
DROP TABLE IF EXISTS payment_runs CASCADE;
DROP TABLE IF EXISTS approval_tasks CASCADE;
DROP TABLE IF EXISTS approval_rules CASCADE;
DROP TABLE IF EXISTS incoming_invoice_documents CASCADE;
DROP TABLE IF EXISTS incoming_invoice_lines CASCADE;
DROP TABLE IF EXISTS incoming_invoices CASCADE;
DROP TABLE IF EXISTS supplier_bank_accounts CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS incoming_documents CASCADE;
DROP TABLE IF EXISTS inbox_items CASCADE;
DROP TABLE IF EXISTS inbox_aliases CASCADE;

-- Audit rows referencing the dropped entities are kept: payment_audit_events is
-- an append-only trail and its entity_id is not a foreign key. Nothing to do.

COMMIT;
