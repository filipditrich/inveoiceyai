-- Plan 26d — permission catalog and per-member overrides (ADR 0038).
--
-- Additive only. The catalog and role presets live in code
-- (`apps/web/lib/authz/catalog.ts`); the one thing that needs storage is the
-- explicit per-member deviation, and it is only read when the plan's
-- `permissions.mode` is `advanced` — so a downgrade stops enforcing rules the
-- workspace can no longer see or edit.
--
-- Idempotent and safe to re-run.

BEGIN;

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS permission_overrides jsonb;

COMMENT ON COLUMN members.permission_overrides IS
  '{"grant": ["..."], "deny": ["..."]} layered over the role preset; deny wins.';

COMMIT;
