-- Plan 24: incoming invoices, inbound capture, approvals, payables, Fio submit.
-- Safe to run repeatedly.

ALTER TABLE bank_connections
  ADD COLUMN IF NOT EXISTS payment_secret_ciphertext text,
  ADD COLUMN IF NOT EXISTS payment_secret_fingerprint text,
  ADD COLUMN IF NOT EXISTS payment_key_version integer,
  ADD COLUMN IF NOT EXISTS payment_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_last_request_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_enabled_by_user_id text REFERENCES users(id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TABLE bank_connections DROP CONSTRAINT IF EXISTS bank_connections_access_check;
  ALTER TABLE bank_connections
    ADD CONSTRAINT bank_connections_access_check
    CHECK (access_mode IN ('read', 'read_write'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_import_scope_check;
  ALTER TABLE bank_accounts
    ADD CONSTRAINT bank_accounts_import_scope_check
    CHECK (import_scope IN ('incoming', 'all'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE ai_usage_events DROP CONSTRAINT IF EXISTS ai_usage_events_product_check;
  ALTER TABLE ai_usage_events
    ADD CONSTRAINT ai_usage_events_product_check
    CHECK (product IN ('web', 'slack', 'mcp', 'incoming_invoice_extract'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS inbox_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issuer_id uuid REFERENCES issuer_businesses(id) ON DELETE SET NULL,
  local_part text NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  rotated_from_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS inbox_aliases_local_part_uidx ON inbox_aliases (local_part);
CREATE INDEX IF NOT EXISTS inbox_aliases_workspace_idx ON inbox_aliases (workspace_id, is_active);

CREATE TABLE IF NOT EXISTS inbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source text NOT NULL,
  alias_id uuid REFERENCES inbox_aliases(id) ON DELETE SET NULL,
  issuer_id uuid REFERENCES issuer_businesses(id) ON DELETE SET NULL,
  provider_message_id text,
  rfc_message_id text,
  from_address text,
  from_name text,
  parsed_original_from text,
  to_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  subject text,
  body_text text,
  auth_results jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'received',
  error_code text,
  document_count integer NOT NULL DEFAULT 0,
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inbox_items_source_check CHECK (source IN ('email', 'upload')),
  CONSTRAINT inbox_items_status_check CHECK (status IN ('received', 'processing', 'processed', 'no_invoice', 'rejected', 'failed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS inbox_items_workspace_provider_uidx
  ON inbox_items (workspace_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inbox_items_workspace_received_idx ON inbox_items (workspace_id, received_at DESC);
CREATE INDEX IF NOT EXISTS inbox_items_workspace_status_idx ON inbox_items (workspace_id, status);

CREATE TABLE IF NOT EXISTS incoming_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  inbox_item_id uuid REFERENCES inbox_items(id) ON DELETE SET NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  byte_size integer NOT NULL,
  sha256 text NOT NULL,
  kind text NOT NULL,
  classification text,
  classification_source text,
  extraction_status text NOT NULL DEFAULT 'pending',
  extraction_error text,
  retain_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incoming_documents_kind_check CHECK (kind IN ('pdf', 'isdoc', 'isdocx', 'image', 'other')),
  CONSTRAINT incoming_documents_extraction_check CHECK (extraction_status IN ('pending', 'succeeded', 'failed', 'skipped'))
);
CREATE UNIQUE INDEX IF NOT EXISTS incoming_documents_workspace_sha256_uidx
  ON incoming_documents (workspace_id, sha256);
CREATE INDEX IF NOT EXISTS incoming_documents_inbox_item_idx ON incoming_documents (inbox_item_id);

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ico text,
  dic text,
  vat_id text,
  name text NOT NULL,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  country text NOT NULL DEFAULT 'CZ',
  source text NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  default_currency text,
  payment_terms_days integer,
  is_trusted boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_workspace_ico_uidx
  ON suppliers (workspace_id, ico)
  WHERE coalesce(ico, '') <> '';
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_workspace_name_uidx
  ON suppliers (
    workspace_id,
    lower(regexp_replace(btrim(name), '\s+', ' ', 'g')),
    country
  )
  WHERE coalesce(ico, '') = '';
CREATE INDEX IF NOT EXISTS suppliers_workspace_updated_idx ON suppliers (workspace_id, updated_at);

CREATE TABLE IF NOT EXISTS supplier_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  iban text,
  account_number text,
  bank_code text,
  bic text,
  currency text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  first_seen_document_id uuid,
  confirmed_at timestamptz,
  confirmed_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  is_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS supplier_bank_accounts_identity_uidx
  ON supplier_bank_accounts (
    supplier_id,
    coalesce(iban, account_number || '/' || bank_code)
  );
CREATE INDEX IF NOT EXISTS supplier_bank_accounts_supplier_idx ON supplier_bank_accounts (supplier_id);

CREATE TABLE IF NOT EXISTS incoming_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issuer_id uuid NOT NULL REFERENCES issuer_businesses(id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE RESTRICT,
  inbox_item_id uuid REFERENCES inbox_items(id) ON DELETE SET NULL,
  primary_document_id uuid REFERENCES incoming_documents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'needs_review',
  doc_type text NOT NULL DEFAULT 'invoice',
  number text,
  number_normalized text,
  supplier_name_raw text,
  supplier_ico_raw text,
  variable_symbol text,
  constant_symbol text,
  specific_symbol text,
  issue_date text,
  tax_date text,
  due_date text,
  received_date text NOT NULL,
  currency text NOT NULL DEFAULT 'CZK',
  subtotal numeric(14,2),
  vat_total numeric(14,2),
  total numeric(14,2),
  vat_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_method text NOT NULL DEFAULT 'transfer',
  beneficiary_iban text,
  beneficiary_account_number text,
  beneficiary_bank_code text,
  beneficiary_bic text,
  supplier_bank_account_id uuid REFERENCES supplier_bank_accounts(id) ON DELETE SET NULL,
  message_for_recipient text,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  payment_state text NOT NULL DEFAULT 'unpaid',
  extraction_source text NOT NULL,
  extraction_confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  extraction_model text,
  extracted_at timestamptz,
  accepted_at timestamptz,
  accepted_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejected_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason text,
  hold_until date,
  hold_reason text,
  cancelled_at timestamptz,
  duplicate_of_id uuid,
  credit_note_of_id uuid,
  active_payment_run_id uuid,
  external_key text,
  retain_until date NOT NULL,
  notes text,
  exception_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incoming_invoices_status_check CHECK (status IN (
    'needs_review', 'extract_failed', 'accepted', 'pending_approval',
    'approved', 'on_hold', 'rejected', 'cancelled'
  )),
  CONSTRAINT incoming_invoices_doc_type_check CHECK (doc_type IN ('invoice', 'credit_note', 'proforma', 'advance')),
  CONSTRAINT incoming_invoices_payment_state_check CHECK (payment_state IN ('unpaid', 'partial', 'paid', 'overpaid')),
  CONSTRAINT incoming_invoices_payment_method_check CHECK (payment_method IN ('transfer', 'card', 'cash', 'direct_debit', 'other')),
  CONSTRAINT incoming_invoices_extraction_source_check CHECK (extraction_source IN ('isdoc', 'isdoc_pdf', 'ai', 'manual'))
);
CREATE UNIQUE INDEX IF NOT EXISTS incoming_invoices_identity_uidx
  ON incoming_invoices (workspace_id, issuer_id, supplier_id, number_normalized)
  WHERE supplier_id IS NOT NULL
    AND number_normalized IS NOT NULL
    AND cancelled_at IS NULL
    AND status <> 'rejected';
CREATE INDEX IF NOT EXISTS incoming_invoices_workspace_status_idx ON incoming_invoices (workspace_id, status);
CREATE INDEX IF NOT EXISTS incoming_invoices_workspace_due_idx ON incoming_invoices (workspace_id, due_date);
CREATE INDEX IF NOT EXISTS incoming_invoices_workspace_supplier_idx ON incoming_invoices (workspace_id, supplier_id);
CREATE INDEX IF NOT EXISTS incoming_invoices_workspace_issuer_idx ON incoming_invoices (workspace_id, issuer_id);
CREATE INDEX IF NOT EXISTS incoming_invoices_workspace_external_idx ON incoming_invoices (workspace_id, external_key);

CREATE TABLE IF NOT EXISTS incoming_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incoming_invoice_id uuid NOT NULL REFERENCES incoming_invoices(id) ON DELETE CASCADE,
  position integer NOT NULL,
  description text NOT NULL,
  quantity numeric(14,4) NOT NULL,
  unit text,
  unit_price_without_vat numeric(14,4),
  vat_rate text,
  line_subtotal numeric(14,2),
  line_vat numeric(14,2),
  line_total numeric(14,2)
);
CREATE INDEX IF NOT EXISTS incoming_invoice_lines_invoice_idx ON incoming_invoice_lines (incoming_invoice_id);

CREATE TABLE IF NOT EXISTS incoming_invoice_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incoming_invoice_id uuid NOT NULL REFERENCES incoming_invoices(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES incoming_documents(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS incoming_invoice_documents_pair_uidx
  ON incoming_invoice_documents (incoming_invoice_id, document_id);

CREATE TABLE IF NOT EXISTS approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  priority integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  conditions_version integer NOT NULL DEFAULT 1,
  conditions jsonb NOT NULL,
  path jsonb NOT NULL,
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS approval_rules_workspace_priority_uidx
  ON approval_rules (workspace_id, priority);

CREATE TABLE IF NOT EXISTS approval_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  incoming_invoice_id uuid NOT NULL REFERENCES incoming_invoices(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES approval_rules(id) ON DELETE SET NULL,
  step integer NOT NULL DEFAULT 1,
  assignee_user_id text REFERENCES users(id) ON DELETE SET NULL,
  assignee_role text,
  status text NOT NULL DEFAULT 'pending',
  decided_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_tasks_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'skipped', 'cancelled')),
  CONSTRAINT approval_tasks_assignee_check CHECK (
    (assignee_user_id IS NOT NULL AND assignee_role IS NULL)
    OR (assignee_user_id IS NULL AND assignee_role IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS approval_tasks_workspace_status_idx ON approval_tasks (workspace_id, status);
CREATE INDEX IF NOT EXISTS approval_tasks_assignee_status_idx ON approval_tasks (assignee_user_id, status);
CREATE INDEX IF NOT EXISTS approval_tasks_invoice_idx ON approval_tasks (incoming_invoice_id);

CREATE TABLE IF NOT EXISTS payment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issuer_id uuid NOT NULL REFERENCES issuer_businesses(id) ON DELETE RESTRICT,
  bank_account_id uuid NOT NULL,
  name text NOT NULL,
  execution_date text NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_count integer NOT NULL DEFAULT 0,
  provider text NOT NULL DEFAULT 'fio',
  provider_batch_id text,
  provider_status text,
  provider_message text,
  submit_attempt_count integer NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  submitted_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_runs_status_check CHECK (status IN (
    'draft', 'ready', 'submitting', 'submitted', 'failed', 'cancelled', 'closed'
  ))
);
CREATE INDEX IF NOT EXISTS payment_runs_workspace_status_idx ON payment_runs (workspace_id, status);
CREATE INDEX IF NOT EXISTS payment_runs_workspace_created_idx ON payment_runs (workspace_id, created_at);

DO $$
BEGIN
  ALTER TABLE incoming_invoices
    ADD CONSTRAINT incoming_invoices_active_run_fk
    FOREIGN KEY (active_payment_run_id) REFERENCES payment_runs(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS payment_run_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  payment_run_id uuid NOT NULL REFERENCES payment_runs(id) ON DELETE CASCADE,
  incoming_invoice_id uuid NOT NULL REFERENCES incoming_invoices(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL,
  beneficiary_name text,
  beneficiary_iban text,
  beneficiary_account_number text,
  beneficiary_bank_code text,
  beneficiary_bic text,
  variable_symbol text,
  constant_symbol text,
  specific_symbol text,
  message_for_recipient text,
  comment text,
  rail text NOT NULL,
  status text NOT NULL DEFAULT 'included',
  drop_reason text,
  sequence integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_run_lines_run_invoice_uidx
  ON payment_run_lines (payment_run_id, incoming_invoice_id);
CREATE INDEX IF NOT EXISTS payment_run_lines_invoice_idx ON payment_run_lines (incoming_invoice_id);

CREATE TABLE IF NOT EXISTS payable_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  incoming_invoice_id uuid NOT NULL REFERENCES incoming_invoices(id) ON DELETE CASCADE,
  bank_transaction_id uuid REFERENCES bank_transactions(id) ON DELETE RESTRICT,
  proposal_id uuid,
  source text NOT NULL,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL,
  effective_date text NOT NULL,
  confirmed_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  reversed_at timestamptz,
  reversed_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  reversal_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payable_payment_allocations_amount_check CHECK (amount > 0)
);
CREATE INDEX IF NOT EXISTS payable_payment_allocations_invoice_idx
  ON payable_payment_allocations (workspace_id, incoming_invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS payable_payment_allocations_transaction_invoice_uidx
  ON payable_payment_allocations (bank_transaction_id, incoming_invoice_id)
  WHERE reversed_at IS NULL;

CREATE TABLE IF NOT EXISTS payable_match_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  bank_transaction_id uuid NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
  incoming_invoice_id uuid NOT NULL REFERENCES incoming_invoices(id) ON DELETE CASCADE,
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
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payable_match_proposals_version_uidx
  ON payable_match_proposals (bank_transaction_id, incoming_invoice_id, matcher_version);
CREATE INDEX IF NOT EXISTS payable_match_proposals_workspace_status_idx
  ON payable_match_proposals (workspace_id, status);
