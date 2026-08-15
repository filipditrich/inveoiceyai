-- Widen bank_connections.provider to allow MONETA alongside Fio.
-- Idempotent: safe to re-run.

DO $$
BEGIN
  ALTER TABLE bank_connections DROP CONSTRAINT IF EXISTS bank_connections_provider_check;
  ALTER TABLE bank_connections
    ADD CONSTRAINT bank_connections_provider_check
    CHECK (provider IN ('fio', 'moneta'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
