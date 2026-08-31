-- Plan 29 S2 — published community look documents.

CREATE TABLE IF NOT EXISTS community_looks (
  id uuid PRIMARY KEY,
  look_id text NOT NULL,
  version text NOT NULL,
  document jsonb NOT NULL,
  publisher_workspace_id text NOT NULL,
  unpublished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS community_looks_look_version
  ON community_looks (look_id, version);

CREATE INDEX IF NOT EXISTS community_looks_publisher_idx
  ON community_looks (publisher_workspace_id);
