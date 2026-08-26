-- Drop the incoming-invoices / payables domain
--
-- DESTRUCTIVE and intentional. The feature is removed from the product and
-- archived on the `feat/payables-lifecycle` branch (tag
-- `archive/payables-lifecycle`) for reimplementation inside the NFCtron
-- ecosystem, which already has the Pohoda mServer client and the multi-actor
-- org structure it needs.
--
-- NOT touched — these belong to the issued side (Plan 22/23) and stay:
--   bank_connections, bank_accounts, bank_account_issuers, bank_transactions,
--   payment_match_proposals, invoice_payment_allocations, payment_audit_events
--
-- payment_audit_events keeps its historical rows for the dropped entity types.
-- It is an append-only trail with no foreign key to them, so the evidence of
-- what happened survives the feature being removed. That is deliberate.

BEGIN;

DROP TABLE IF EXISTS payable_match_proposals CASCADE;
DROP TABLE IF EXISTS payable_payment_allocations CASCADE;
DROP TABLE IF EXISTS payment_run_lines CASCADE;
DROP TABLE IF EXISTS payment_runs CASCADE;
DROP TABLE IF EXISTS approval_tasks CASCADE;
DROP TABLE IF EXISTS approval_rules CASCADE;
DROP TABLE IF EXISTS workflow_path_step_approvers CASCADE;
DROP TABLE IF EXISTS workflow_path_steps CASCADE;
DROP TABLE IF EXISTS workflow_paths CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS incoming_invoice_documents CASCADE;
DROP TABLE IF EXISTS incoming_invoice_lines CASCADE;
DROP TABLE IF EXISTS incoming_invoices CASCADE;
DROP TABLE IF EXISTS supplier_bank_accounts CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS incoming_documents CASCADE;
DROP TABLE IF EXISTS inbox_items CASCADE;
DROP TABLE IF EXISTS inbox_aliases CASCADE;

-- Narrow the AI product list back: nothing extracts incoming invoices now.
-- Verified zero rows carry this value before dropping it from the constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ai_usage_events WHERE product = 'incoming_invoice_extract'
  ) THEN
    ALTER TABLE ai_usage_events DROP CONSTRAINT IF EXISTS ai_usage_events_product_check;
    ALTER TABLE ai_usage_events
      ADD CONSTRAINT ai_usage_events_product_check
      CHECK (product IN ('web', 'slack', 'mcp'));
  END IF;
END $$;

COMMIT;

-- Left alone on purpose:
--   bank_accounts.import_scope ('incoming' here means incoming bank credits,
--     not incoming invoices)
--   bank_connections.access_mode — 'read_write' existed for Fio payment
--     submission, which is gone. The column stays because nothing writes
--     payments any more; narrowing it would rewrite live rows for no gain.
