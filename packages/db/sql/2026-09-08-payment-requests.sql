-- Plan 36b — standalone payment requests + polymorphic allocations (ADR 0050).
-- Apply on every environment before a build that writes a null invoice_id.

CREATE TABLE IF NOT EXISTS payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issuer_id uuid NOT NULL REFERENCES issuer_businesses(id) ON DELETE RESTRICT,
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  amount numeric(18, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'CZK',
  variable_symbol text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'open',
  public_token text NOT NULL,
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  settled_at timestamptz,
  stale_after timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_requests_amount_check CHECK (amount > 0),
  CONSTRAINT payment_requests_currency_check CHECK (currency = 'CZK'),
  CONSTRAINT payment_requests_status_check CHECK (status IN ('open', 'settled', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_requests_account_symbol_uidx
  ON payment_requests (bank_account_id, variable_symbol);
CREATE UNIQUE INDEX IF NOT EXISTS payment_requests_public_token_uidx
  ON payment_requests (public_token);
CREATE INDEX IF NOT EXISTS payment_requests_workspace_status_idx
  ON payment_requests (workspace_id, status);
CREATE INDEX IF NOT EXISTS payment_requests_workspace_created_idx
  ON payment_requests (workspace_id, created_at);

DO $$
BEGIN
  IF to_regclass('public.invoice_payment_allocations') IS NOT NULL
     AND to_regclass('public.payment_allocations') IS NULL THEN
    ALTER TABLE invoice_payment_allocations RENAME TO payment_allocations;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.payment_allocations') IS NOT NULL THEN
    ALTER TABLE payment_allocations
      ADD COLUMN IF NOT EXISTS payment_request_id uuid;
    ALTER TABLE payment_allocations
      ALTER COLUMN invoice_id DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.payment_allocations') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'payment_allocations_payment_request_id_fkey'
     ) THEN
    ALTER TABLE payment_allocations
      ADD CONSTRAINT payment_allocations_payment_request_id_fkey
      FOREIGN KEY (payment_request_id) REFERENCES payment_requests(id)
      ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE payment_allocations
  DROP CONSTRAINT IF EXISTS payment_allocations_target_chk;
ALTER TABLE payment_allocations
  ADD CONSTRAINT payment_allocations_target_chk CHECK (
    (invoice_id IS NOT NULL AND payment_request_id IS NULL)
    OR (invoice_id IS NULL AND payment_request_id IS NOT NULL)
  );

ALTER INDEX IF EXISTS invoice_payment_allocations_invoice_idx
  RENAME TO payment_allocations_invoice_idx;
ALTER INDEX IF EXISTS invoice_payment_allocations_transaction_idx
  RENAME TO payment_allocations_transaction_idx;
ALTER INDEX IF EXISTS invoice_payment_allocations_legacy_invoice_uidx
  RENAME TO payment_allocations_legacy_invoice_uidx;

DROP INDEX IF EXISTS invoice_payment_allocations_transaction_invoice_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS payment_allocations_transaction_invoice_uidx
  ON payment_allocations (bank_transaction_id, invoice_id)
  WHERE reversed_at IS NULL AND invoice_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_allocations_transaction_request_uidx
  ON payment_allocations (bank_transaction_id, payment_request_id)
  WHERE reversed_at IS NULL AND payment_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_allocations_request_idx
  ON payment_allocations (workspace_id, payment_request_id);

ALTER TABLE payment_match_proposals
  ADD COLUMN IF NOT EXISTS payment_request_id uuid;
ALTER TABLE payment_match_proposals
  ALTER COLUMN invoice_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_match_proposals_payment_request_id_fkey'
  ) THEN
    ALTER TABLE payment_match_proposals
      ADD CONSTRAINT payment_match_proposals_payment_request_id_fkey
      FOREIGN KEY (payment_request_id) REFERENCES payment_requests(id)
      ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE payment_match_proposals
  DROP CONSTRAINT IF EXISTS payment_match_proposals_target_chk;
ALTER TABLE payment_match_proposals
  ADD CONSTRAINT payment_match_proposals_target_chk CHECK (
    (invoice_id IS NOT NULL AND payment_request_id IS NULL)
    OR (invoice_id IS NULL AND payment_request_id IS NOT NULL)
  );

DROP INDEX IF EXISTS payment_match_proposals_version_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS payment_match_proposals_invoice_version_uidx
  ON payment_match_proposals (bank_transaction_id, invoice_id, matcher_version)
  WHERE invoice_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_match_proposals_request_version_uidx
  ON payment_match_proposals (bank_transaction_id, payment_request_id, matcher_version)
  WHERE payment_request_id IS NOT NULL;
