-- Plan 26b — declarative token grants (ADR 0037).
--
-- One append-only ledger for every one-time token award: plan signup rules,
-- the first-invoice milestone, and platform-admin discretionary grants. The
-- unique index IS the idempotency mechanism — apply is an insert-or-skip in
-- the same transaction as the credit — so a retried invoice issue can neither
-- double-pay nor double-notify.
--
-- Idempotent and safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS workspace_token_grants (
  id           uuid PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  -- A plan rule key, or `manual:<uuid>` for a discretionary grant.
  rule_key     text NOT NULL,
  trigger      text NOT NULL CHECK (trigger IN ('signup', 'first_invoice_issued', 'manual')),
  bucket       text NOT NULL CHECK (bucket IN ('monthly', 'gifted', 'purchased')),
  tokens       bigint NOT NULL,
  granted_by   text REFERENCES users (id) ON DELETE SET NULL,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_token_grants_rule_uidx
  ON workspace_token_grants (workspace_id, rule_key);

CREATE INDEX IF NOT EXISTS workspace_token_grants_workspace_idx
  ON workspace_token_grants (workspace_id, created_at);

-- ---------------------------------------------------------------------------
-- Backfill the signup award for workspaces that predate the ledger.
--
-- Every existing workspace was created under the old hardcoded
-- SIGNUP_GIFTED_TOKENS = 500_000 rule. Recording that as a ledger row credits
-- nothing new — the tokens are already in the balance — it just stops those
-- workspaces from looking like they were never granted anything, and (more
-- importantly) claims the `signup_v1` key so the rule cannot fire a second
-- time and hand out a duplicate award.
-- ---------------------------------------------------------------------------

INSERT INTO workspace_token_grants (id, workspace_id, rule_key, trigger, bucket, tokens, note, created_at)
SELECT gen_random_uuid(), w.id, 'signup_v1', 'signup', 'gifted', 500000,
       'Backfilled: granted before the token ledger existed', w.created_at
  FROM workspaces w
ON CONFLICT (workspace_id, rule_key) DO NOTHING;

COMMIT;
