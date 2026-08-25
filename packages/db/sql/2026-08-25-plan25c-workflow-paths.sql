-- Plan 25c — workflow paths and teams
--
-- Additive. New tables and columns are created by `bun db:push` from
-- `packages/db/src/incoming-schema.ts`; this file records what that push does
-- so the change is reviewable without diffing the schema.
--
-- New tables:
--   teams, team_members
--   workflow_paths, workflow_path_steps, workflow_path_step_approvers
--
-- Changed:
--   approval_rules   + path_id (FK -> workflow_paths), - path (jsonb)
--                    the UNIQUE (workspace_id, priority) index becomes a plain
--                    index: two rules may share a priority and are ordered by
--                    created_at. The unique index made creating a second rule
--                    at the default priority throw.
--   approval_tasks   + stage, path_id, path_step_id, line_id, required,
--                      escalated_at, reminded_at, delegated_from_task_id
--
-- Run after 2026-08-25-plan25a-payables-reset.sql, in the same db:push.
--
-- The statements db:push will not do on its own, because they drop things that
-- only exist in a database pushed before 25c. A database that went through the
-- 25a reset has no approval_rules table at this point, so both are skipped.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'approval_rules'
  ) THEN
    ALTER TABLE approval_rules DROP COLUMN IF EXISTS path;
    DROP INDEX IF EXISTS approval_rules_workspace_priority_uidx;
  END IF;
END $$;
