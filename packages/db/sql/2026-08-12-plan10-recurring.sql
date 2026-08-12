-- Plan 10: invoice templates + recurring schedules (draft-only HITL).

CREATE TABLE IF NOT EXISTS invoice_templates (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  issuer_id uuid NOT NULL REFERENCES issuer_businesses (id),
  client_id uuid NOT NULL REFERENCES clients (id),
  name text NOT NULL,
  doc_type text NOT NULL,
  payment_due_days integer NOT NULL,
  payload_json jsonb NOT NULL,
  source_invoice_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_templates_workspace_name
  ON invoice_templates (workspace_id, name);

CREATE INDEX IF NOT EXISTS invoice_templates_workspace_idx
  ON invoice_templates (workspace_id);

CREATE TABLE IF NOT EXISTS recurring_schedules (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  template_id uuid NOT NULL REFERENCES invoice_templates (id) ON DELETE CASCADE,
  cadence text NOT NULL,
  day_of_month integer NOT NULL,
  next_run_on text NOT NULL,
  paused integer NOT NULL DEFAULT 0,
  last_run_on text,
  last_invoice_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS recurring_schedules_template
  ON recurring_schedules (template_id);

CREATE INDEX IF NOT EXISTS recurring_schedules_due_idx
  ON recurring_schedules (paused, next_run_on);

CREATE INDEX IF NOT EXISTS recurring_schedules_workspace_idx
  ON recurring_schedules (workspace_id);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS recurring_schedule_id uuid;

DO $$
BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT invoices_recurring_schedule_id_fkey
    FOREIGN KEY (recurring_schedule_id)
    REFERENCES recurring_schedules (id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS invoices_recurring_schedule_idx
  ON invoices (recurring_schedule_id);
