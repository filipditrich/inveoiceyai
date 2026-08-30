-- Plan 26c — managed client catalogs (ADR 0036).
--
-- A plan can define the exact set of counterparties its workspaces may invoice.
-- Entries are materialized INTO each workspace rather than read across them:
-- separate workspaces exist precisely so no contractor sees another's data, and
-- a cross-tenant read would need a tenancy exception in every client query.
--
-- Idempotent and safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS plan_clients (
  id         uuid PRIMARY KEY,
  plan_id    text NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
  -- Digits only: the identity clients_workspace_ico_uidx already dedupes on.
  ico        text NOT NULL,
  snapshot   jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS plan_clients_plan_ico_uidx
  ON plan_clients (plan_id, ico);

-- `set null`, not cascade: dropping a catalog entry must never delete a
-- counterparty a workspace has already invoiced. It only stops being billable.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS plan_client_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_plan_client_id_fkey'
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT clients_plan_client_id_fkey
      FOREIGN KEY (plan_client_id) REFERENCES plan_clients (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS clients_plan_client_idx ON clients (plan_client_id);

COMMIT;
