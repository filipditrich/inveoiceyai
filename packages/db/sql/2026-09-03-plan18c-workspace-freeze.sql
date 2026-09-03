-- Plan 18c / ADR 0046: workspace occupancy freeze.
-- Occupancy, not an entitlement. Apply on Neon; do not unattended db:push.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS frozen_by text,
  ADD COLUMN IF NOT EXISTS freeze_reason text;

CREATE INDEX IF NOT EXISTS workspaces_frozen_idx
  ON workspaces (frozen_at)
  WHERE frozen_at IS NOT NULL;
