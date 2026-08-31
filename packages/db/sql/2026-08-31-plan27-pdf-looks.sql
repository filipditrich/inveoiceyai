-- Plan 27 S0 — PDF looks: workspace default, invoice look columns, entitlement backfill.

BEGIN;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS default_look_id text NOT NULL DEFAULT 'classic';
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS default_look_version text NOT NULL DEFAULT '1.0.0';

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS look_id text;
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS look_version text;

UPDATE plans
SET entitlements = jsonb_set(
  entitlements,
  '{looks}',
  '{"apply":"classic"}'::jsonb,
  true
)
WHERE entitlements->'looks' IS NULL;

UPDATE plans
SET entitlements = jsonb_set(
  entitlements,
  '{looks}',
  '{"apply":"catalog"}'::jsonb,
  true
)
WHERE key IN ('pro', 'enterprise', 'nfctron');

COMMIT;
