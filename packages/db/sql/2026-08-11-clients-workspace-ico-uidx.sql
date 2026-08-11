-- One client per IČO per workspace (partial unique index).
-- Prerequisite: mergeDuplicateClients (or manual cleanup) so no duplicate IČOs remain.

CREATE UNIQUE INDEX IF NOT EXISTS clients_workspace_ico_uidx
  ON clients (workspace_id, (snapshot->>'ico'))
  WHERE snapshot->>'ico' IS NOT NULL AND btrim(snapshot->>'ico') <> '';
