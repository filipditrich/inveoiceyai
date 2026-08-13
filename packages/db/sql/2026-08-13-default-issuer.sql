-- Workspace default issuer for Eve / MCP / in-app AI (not last-updated).

ALTER TABLE issuer_businesses
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

UPDATE issuer_businesses AS i
SET is_default = true
WHERE NOT EXISTS (
    SELECT 1
    FROM issuer_businesses d
    WHERE d.workspace_id = i.workspace_id
      AND d.is_default
  )
  AND i.id IN (
    SELECT DISTINCT ON (workspace_id) id
    FROM issuer_businesses
    ORDER BY workspace_id, created_at ASC, id ASC
  );

CREATE UNIQUE INDEX IF NOT EXISTS issuer_businesses_workspace_default_uidx
  ON issuer_businesses (workspace_id)
  WHERE is_default;
