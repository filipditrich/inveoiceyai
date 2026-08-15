-- Prevent duplicate clients across web, Slack, MCP, AI, and imports.
--
-- This first collapses existing duplicates and repoints every live client FK.
-- IČO is authoritative. An IČO-less row may also join the one known entity at
-- the same normalized legal name + full address. Two different known IČOs are
-- never merged solely because their names and addresses happen to match.

BEGIN;

LOCK TABLE clients IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE client_duplicate_map (
  drop_id uuid PRIMARY KEY,
  keep_id uuid NOT NULL
) ON COMMIT DROP;

-- Pass 1: formatted variants of the same IČO.
INSERT INTO client_duplicate_map (drop_id, keep_id)
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY workspace_id,
        regexp_replace(coalesce(snapshot->>'ico', ''), '\D', '', 'g')
      ORDER BY created_at, id
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY workspace_id,
        regexp_replace(coalesce(snapshot->>'ico', ''), '\D', '', 'g')
      ORDER BY created_at, id
    ) AS position
  FROM clients
  WHERE regexp_replace(coalesce(snapshot->>'ico', ''), '\D', '', 'g') <> ''
)
SELECT id, keep_id FROM ranked WHERE position > 1;

UPDATE invoices AS target
SET client_id = mapping.keep_id, updated_at = now()
FROM client_duplicate_map AS mapping
WHERE target.client_id = mapping.drop_id;

UPDATE invoice_templates AS target
SET client_id = mapping.keep_id, updated_at = now()
FROM client_duplicate_map AS mapping
WHERE target.client_id = mapping.drop_id;

DELETE FROM clients AS target
USING client_duplicate_map AS mapping
WHERE target.id = mapping.drop_id;

TRUNCATE client_duplicate_map;

-- Pass 2: same legal name + full address, but only if the group contains at
-- most one distinct known IČO. Prefer that identified row as the survivor.
INSERT INTO client_duplicate_map (drop_id, keep_id)
WITH identities AS (
  SELECT
    id,
    workspace_id,
    created_at,
    regexp_replace(coalesce(snapshot->>'ico', ''), '\D', '', 'g') AS ico,
    concat_ws('|',
      lower(regexp_replace(btrim(coalesce(snapshot->>'name', '')), '\s+', ' ', 'g')),
      lower(regexp_replace(btrim(coalesce(snapshot->'address'->>'street', '')), '\s+', ' ', 'g')),
      lower(regexp_replace(btrim(coalesce(snapshot->'address'->>'city', '')), '\s+', ' ', 'g')),
      lower(regexp_replace(btrim(coalesce(snapshot->'address'->>'zip', '')), '\s+', '', 'g')),
      lower(btrim(coalesce(snapshot->'address'->>'country', '')))
    ) AS identity
  FROM clients
  WHERE btrim(coalesce(snapshot->>'name', '')) <> ''
    AND btrim(coalesce(snapshot->'address'->>'street', '')) <> ''
    AND btrim(coalesce(snapshot->'address'->>'city', '')) <> ''
    AND btrim(coalesce(snapshot->'address'->>'zip', '')) <> ''
    AND btrim(coalesce(snapshot->'address'->>'country', '')) <> ''
), safe_identities AS (
  SELECT workspace_id, identity
  FROM identities
  GROUP BY workspace_id, identity
  HAVING count(*) > 1
    AND count(DISTINCT nullif(ico, '')) <= 1
), ranked AS (
  SELECT
    identities.id,
    first_value(identities.id) OVER (
      PARTITION BY identities.workspace_id, identities.identity
      ORDER BY (identities.ico <> '') DESC, identities.created_at, identities.id
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY identities.workspace_id, identities.identity
      ORDER BY (identities.ico <> '') DESC, identities.created_at, identities.id
    ) AS position
  FROM identities
  INNER JOIN safe_identities USING (workspace_id, identity)
)
SELECT id, keep_id FROM ranked WHERE position > 1;

UPDATE invoices AS target
SET client_id = mapping.keep_id, updated_at = now()
FROM client_duplicate_map AS mapping
WHERE target.client_id = mapping.drop_id;

UPDATE invoice_templates AS target
SET client_id = mapping.keep_id, updated_at = now()
FROM client_duplicate_map AS mapping
WHERE target.client_id = mapping.drop_id;

DELETE FROM clients AS target
USING client_duplicate_map AS mapping
WHERE target.id = mapping.drop_id;

DROP INDEX IF EXISTS clients_workspace_ico_uidx;

CREATE UNIQUE INDEX clients_workspace_ico_uidx
  ON clients (
    workspace_id,
    regexp_replace(coalesce(snapshot->>'ico', ''), '\D', '', 'g')
  )
  WHERE regexp_replace(coalesce(snapshot->>'ico', ''), '\D', '', 'g') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS clients_workspace_address_identity_uidx
  ON clients (
    workspace_id,
    lower(regexp_replace(btrim(coalesce(snapshot->>'name', '')), '\s+', ' ', 'g')),
    lower(regexp_replace(btrim(coalesce(snapshot->'address'->>'street', '')), '\s+', ' ', 'g')),
    lower(regexp_replace(btrim(coalesce(snapshot->'address'->>'city', '')), '\s+', ' ', 'g')),
    lower(regexp_replace(btrim(coalesce(snapshot->'address'->>'zip', '')), '\s+', '', 'g')),
    lower(btrim(coalesce(snapshot->'address'->>'country', '')))
  )
  WHERE regexp_replace(coalesce(snapshot->>'ico', ''), '\D', '', 'g') = ''
    AND btrim(coalesce(snapshot->>'name', '')) <> ''
    AND btrim(coalesce(snapshot->'address'->>'street', '')) <> ''
    AND btrim(coalesce(snapshot->'address'->>'city', '')) <> ''
    AND btrim(coalesce(snapshot->'address'->>'zip', '')) <> ''
    AND btrim(coalesce(snapshot->'address'->>'country', '')) <> '';

COMMIT;
