-- Plan 22: provider-neutral payment ledger and first read-only Fio connection.
-- Safe to run repeatedly. Existing paid_at facts become legacy allocations.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_state text NOT NULL DEFAULT 'unpaid';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_account_iban text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_variable_symbol text;

CREATE TABLE IF NOT EXISTS bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  access_mode text NOT NULL DEFAULT 'read',
  secret_ciphertext text NOT NULL,
  secret_fingerprint text NOT NULL,
  key_version integer NOT NULL,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  last_rotated_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  token_expires_at timestamptz,
  sync_coverage_through text,
  last_request_at timestamptz,
  lease_until timestamptz,
  last_sync_started_at timestamptz,
  last_sync_succeeded_at timestamptz,
  last_sync_error_code text,
  next_sync_at timestamptz,
  consecutive_failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_connections_provider_check CHECK (provider = 'fio'),
  CONSTRAINT bank_connections_access_check CHECK (access_mode = 'read'),
  CONSTRAINT bank_connections_status_check CHECK (status IN ('active', 'paused', 'reauthorization_required', 'error'))
);
CREATE INDEX IF NOT EXISTS bank_connections_workspace_idx ON bank_connections(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS bank_connections_sync_idx ON bank_connections(status, next_sync_at);
CREATE UNIQUE INDEX IF NOT EXISTS bank_connections_workspace_secret_uidx ON bank_connections(workspace_id, provider, secret_fingerprint);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  account_number text NOT NULL,
  bank_code text NOT NULL,
  iban text NOT NULL,
  bic text,
  currency text NOT NULL,
  display_name text,
  import_scope text NOT NULL DEFAULT 'incoming',
  balance numeric(18,2),
  balance_available numeric(18,2),
  balance_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_accounts_import_scope_check CHECK (import_scope = 'incoming')
);
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_provider_iban_uidx ON bank_accounts(provider, iban);
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_connection_provider_id_uidx ON bank_accounts(connection_id, provider_account_id);
CREATE INDEX IF NOT EXISTS bank_accounts_workspace_idx ON bank_accounts(workspace_id);

CREATE TABLE IF NOT EXISTS bank_account_issuers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  issuer_id uuid NOT NULL REFERENCES issuer_businesses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS bank_account_issuers_account_issuer_uidx ON bank_account_issuers(bank_account_id, issuer_id);
CREATE INDEX IF NOT EXISTS bank_account_issuers_workspace_idx ON bank_account_issuers(workspace_id);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_transaction_id text NOT NULL,
  booked_date text NOT NULL,
  value_date text,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL,
  direction text NOT NULL,
  counterparty_account text,
  counterparty_bank_code text,
  counterparty_iban text,
  counterparty_name text,
  variable_symbol text,
  constant_symbol text,
  specific_symbol text,
  message text,
  transaction_type text,
  provider_reference text,
  payload_hash text NOT NULL,
  possible_reversal_of_id uuid,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_transactions_direction_check CHECK (direction IN ('credit', 'debit'))
);
CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_account_provider_id_uidx ON bank_transactions(bank_account_id, provider_transaction_id);
CREATE INDEX IF NOT EXISTS bank_transactions_workspace_booked_idx ON bank_transactions(workspace_id, booked_date);
CREATE INDEX IF NOT EXISTS bank_transactions_match_idx ON bank_transactions(bank_account_id, variable_symbol, amount);

CREATE TABLE IF NOT EXISTS payment_match_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  bank_transaction_id uuid NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  proposed_amount numeric(18,2) NOT NULL,
  score integer NOT NULL,
  confidence text NOT NULL,
  reason_codes jsonb NOT NULL,
  blocker_codes jsonb NOT NULL,
  matcher_version text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_match_proposals_status_check CHECK (status IN ('pending', 'confirmed', 'rejected', 'superseded')),
  CONSTRAINT payment_match_proposals_confidence_check CHECK (confidence IN ('high', 'medium', 'low'))
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_match_proposals_version_uidx ON payment_match_proposals(bank_transaction_id, invoice_id, matcher_version);
CREATE INDEX IF NOT EXISTS payment_match_proposals_workspace_status_idx ON payment_match_proposals(workspace_id, status);

CREATE TABLE IF NOT EXISTS invoice_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  bank_transaction_id uuid REFERENCES bank_transactions(id) ON DELETE RESTRICT,
  proposal_id uuid REFERENCES payment_match_proposals(id) ON DELETE SET NULL,
  source text NOT NULL,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL,
  effective_date text NOT NULL,
  confirmed_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  reversed_at timestamptz,
  reversed_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  reversal_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_payment_allocations_amount_check CHECK (amount > 0),
  CONSTRAINT invoice_payment_allocations_source_check CHECK (source IN ('bank_confirmed', 'manual', 'legacy_manual'))
);
CREATE INDEX IF NOT EXISTS invoice_payment_allocations_invoice_idx ON invoice_payment_allocations(workspace_id, invoice_id);
CREATE INDEX IF NOT EXISTS invoice_payment_allocations_transaction_idx ON invoice_payment_allocations(bank_transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS invoice_payment_allocations_transaction_invoice_uidx ON invoice_payment_allocations(bank_transaction_id, invoice_id) WHERE reversed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoice_payment_allocations_legacy_invoice_uidx ON invoice_payment_allocations(invoice_id) WHERE source = 'legacy_manual' AND reversed_at IS NULL;

CREATE TABLE IF NOT EXISTS payment_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_type text NOT NULL,
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_audit_events_workspace_created_idx ON payment_audit_events(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS payment_audit_events_entity_idx ON payment_audit_events(entity_type, entity_id);

-- Store issued payment identifiers explicitly so matching never depends on a
-- mutable issuer default. Native invoice payloads already contain these facts.
UPDATE invoices
SET payment_account_iban = upper(regexp_replace(payload_json #>> '{payment,bankAccount,iban}', '[[:space:]]', '', 'g'))
WHERE payment_account_iban IS NULL
  AND coalesce(payload_json #>> '{payment,bankAccount,iban}', '') <> '';

UPDATE invoices
SET payment_variable_symbol = nullif(regexp_replace(payload_json #>> '{payment,variableSymbol}', '[^0-9]', '', 'g'), '')
WHERE payment_variable_symbol IS NULL;

-- Preserve the old paid_at meaning as an explicit ledger entry.
INSERT INTO invoice_payment_allocations (
  workspace_id, invoice_id, source, amount, currency, effective_date
)
SELECT
  workspace_id,
  id,
  'legacy_manual',
  abs(total),
  currency,
  to_char(paid_at AT TIME ZONE 'Europe/Prague', 'YYYY-MM-DD')
FROM invoices
WHERE paid_at IS NOT NULL AND abs(total) > 0
ON CONFLICT DO NOTHING;

UPDATE invoices i
SET
  paid_amount = a.allocated,
  payment_state = CASE
    WHEN a.allocated <= 0 THEN 'unpaid'
    WHEN a.allocated < abs(i.total) THEN 'partial'
    WHEN a.allocated = abs(i.total) THEN 'paid'
    ELSE 'overpaid'
  END
FROM (
  SELECT invoice_id, sum(amount) AS allocated
  FROM invoice_payment_allocations
  WHERE reversed_at IS NULL
  GROUP BY invoice_id
) a
WHERE i.id = a.invoice_id;
