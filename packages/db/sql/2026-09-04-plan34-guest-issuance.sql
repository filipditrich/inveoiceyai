-- Plan 34 — free invoice generator, guest issuance (ADR 0048).
-- Idempotent. Apply with the SQL runner or `bun db:push` from the Drizzle schema.

BEGIN;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS guest_email text;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS unclaimed_since timestamptz;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS claimed_by text;

CREATE INDEX IF NOT EXISTS workspaces_unclaimed_idx
  ON workspaces (unclaimed_since);

CREATE TABLE IF NOT EXISTS guest_issues (
  id                uuid PRIMARY KEY,
  email             text NOT NULL,
  period            text NOT NULL,
  workspace_id      text NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  invoice_id        uuid,
  issuer_ico        text,
  marketing_opt_in  boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- This unique index IS the monthly allowance (ADR 0048 §4) — enforced here,
-- not in application logic, so a race cannot mint two guest issues for one
-- address in one calendar month.
CREATE UNIQUE INDEX IF NOT EXISTS guest_issues_email_period_uidx
  ON guest_issues (email, period);

CREATE INDEX IF NOT EXISTS guest_issues_workspace_idx
  ON guest_issues (workspace_id);

CREATE INDEX IF NOT EXISTS guest_issues_ico_created_idx
  ON guest_issues (issuer_ico, created_at);

CREATE INDEX IF NOT EXISTS guest_issues_created_idx
  ON guest_issues (created_at);

COMMIT;
