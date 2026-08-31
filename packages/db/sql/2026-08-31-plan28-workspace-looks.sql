-- Plan 28 S1 — workspace look documents (versioned rows).

CREATE TABLE IF NOT EXISTS workspace_looks (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  look_id text NOT NULL,
  version text NOT NULL,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_looks_workspace_look_version
  ON workspace_looks (workspace_id, look_id, version);

CREATE INDEX IF NOT EXISTS workspace_looks_workspace_idx
  ON workspace_looks (workspace_id);
