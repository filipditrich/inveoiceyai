-- Plan 26a — plans and entitlement resolution (ADR 0035).
--
-- Order matters: the four seed plans must exist and every workspace must point
-- at one before `plan_id` can be NOT NULL. Run this file as a whole; it is
-- idempotent and safe to re-run.
--
-- Backfill policy: every existing workspace lands on Free. There is no
-- grandfathering override — platform admin upgrades the ones that should be
-- higher from `/admin/plans`, which is exactly the path that has to work anyway.

BEGIN;

CREATE TABLE IF NOT EXISTS plans (
  id                        text PRIMARY KEY,
  key                       text NOT NULL UNIQUE,
  name                      text NOT NULL,
  kind                      text NOT NULL CHECK (kind IN ('builtin', 'custom')),
  entitlements              jsonb NOT NULL,
  auto_assign_email_domains text[] NOT NULL DEFAULT '{}'::text[],
  is_default                boolean NOT NULL DEFAULT false,
  archived_at               timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Exactly one default plan. Across rows, so an index rather than a CHECK.
CREATE UNIQUE INDEX IF NOT EXISTS plans_single_default_uidx
  ON plans (is_default) WHERE is_default;

CREATE INDEX IF NOT EXISTS plans_kind_idx ON plans (kind);

-- ---------------------------------------------------------------------------
-- Seed rows. Entitlement blobs mirror packages/db/src/plan-presets.ts; the
-- seed script is the maintained source and only fills gaps, so ON CONFLICT
-- DO NOTHING here keeps a hand-edited production row from being reverted.
-- ---------------------------------------------------------------------------

INSERT INTO plans (id, key, name, kind, is_default, auto_assign_email_domains, entitlements)
VALUES
  (
    gen_random_uuid()::text, 'free', 'Free', 'builtin', true, '{}'::text[],
    '{"seats":{"max":1},"issuers":{"max":1},
      "ai":{"monthlyIncludedTokens":100000,"topUpEnabled":true,
            "grants":[{"key":"signup_v1","trigger":"signup","tokens":250000,"bucket":"gifted","notify":false},
                      {"key":"first_invoice_issued_v1","trigger":"first_invoice_issued","tokens":500000,"bucket":"gifted","notify":true}]},
      "clients":{"createMode":"open"},"permissions":{"mode":"off"},
      "features":{"bankConnections":false,"recurring":true,"historicalImport":true,"agents":true},
      "auth":{"allowedEmailDomains":[]},"audit":{"retentionDays":30}}'::jsonb
  ),
  (
    gen_random_uuid()::text, 'pro', 'Pro', 'builtin', false, '{}'::text[],
    '{"seats":{"max":5},"issuers":{"max":5},
      "ai":{"monthlyIncludedTokens":1500000,"topUpEnabled":true,
            "grants":[{"key":"signup_v1","trigger":"signup","tokens":500000,"bucket":"gifted","notify":false},
                      {"key":"first_invoice_issued_v1","trigger":"first_invoice_issued","tokens":500000,"bucket":"gifted","notify":true}]},
      "clients":{"createMode":"open"},"permissions":{"mode":"advanced"},
      "features":{"bankConnections":true,"recurring":true,"historicalImport":true,"agents":true},
      "auth":{"allowedEmailDomains":[]},"audit":{"retentionDays":365}}'::jsonb
  ),
  (
    gen_random_uuid()::text, 'enterprise', 'Enterprise', 'builtin', false, '{}'::text[],
    '{"seats":{"max":null},"issuers":{"max":null},
      "ai":{"monthlyIncludedTokens":5000000,"topUpEnabled":true,
            "grants":[{"key":"signup_v1","trigger":"signup","tokens":500000,"bucket":"gifted","notify":false},
                      {"key":"first_invoice_issued_v1","trigger":"first_invoice_issued","tokens":500000,"bucket":"gifted","notify":true}]},
      "clients":{"createMode":"open"},"permissions":{"mode":"advanced"},
      "features":{"bankConnections":true,"recurring":true,"historicalImport":true,"agents":true},
      "auth":{"allowedEmailDomains":[]},"audit":{"retentionDays":null}}'::jsonb
  ),
  (
    gen_random_uuid()::text, 'nfctron', 'NFCtron', 'custom', false, ARRAY['nfctron.com'],
    '{"seats":{"max":3},"issuers":{"max":1},
      "ai":{"monthlyIncludedTokens":1000000,"topUpEnabled":false,"grants":[]},
      "clients":{"createMode":"managed"},"permissions":{"mode":"roles"},
      "features":{"bankConnections":true,"recurring":true,"historicalImport":true,"agents":true},
      "auth":{"allowedEmailDomains":["nfctron.com"]},"audit":{"retentionDays":365}}'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Workspace columns.
-- ---------------------------------------------------------------------------

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS plan_id               text,
  ADD COLUMN IF NOT EXISTS entitlement_overrides jsonb,
  ADD COLUMN IF NOT EXISTS plan_assigned_at      timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS plan_assigned_by      text;

-- Backfill before the NOT NULL.
UPDATE workspaces
   SET plan_id = (SELECT id FROM plans WHERE key = 'free')
 WHERE plan_id IS NULL;

ALTER TABLE workspaces
  ALTER COLUMN plan_id SET NOT NULL;

-- Default to Free so the *currently deployed* code — which does not know about
-- plan_id — can still insert a workspace during the window between this
-- migration running and the new build going live. Without it, NOT NULL breaks
-- signup in production for as long as that window lasts. The application always
-- sets plan_id explicitly; this is purely a deploy-ordering safety net, and it
-- is harmless to keep.
DO $$
DECLARE free_id text;
BEGIN
  SELECT id INTO free_id FROM plans WHERE key = 'free';
  EXECUTE format('ALTER TABLE workspaces ALTER COLUMN plan_id SET DEFAULT %L', free_id);
END $$;

-- RESTRICT, not CASCADE: dropping a plan that still has workspaces must fail
-- loudly rather than orphan tenants. Archive the plan instead.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_plan_id_fkey'
  ) THEN
    ALTER TABLE workspaces
      ADD CONSTRAINT workspaces_plan_id_fkey
      FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS workspaces_plan_idx ON workspaces (plan_id);

-- Existing workspaces keep the balances they already have; only the ceiling
-- moves, and only for workspaces still on the pre-plan default.
UPDATE ai_token_balances b
   SET monthly_limit = (p.entitlements #>> '{ai,monthlyIncludedTokens}')::bigint
  FROM workspaces w
  JOIN plans p ON p.id = w.plan_id
 WHERE b.workspace_id = w.id
   AND b.monthly_limit <> (p.entitlements #>> '{ai,monthlyIncludedTokens}')::bigint;

COMMIT;
