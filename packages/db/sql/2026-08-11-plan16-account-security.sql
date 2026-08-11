-- Plan 16: trusted devices, security audit, Better Auth rate limits

CREATE TABLE IF NOT EXISTS rate_limits (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  count integer NOT NULL,
  last_request bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS trusted_devices (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  label text,
  user_agent text,
  last_ip text,
  trusted_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS trusted_devices_user_token_uidx
  ON trusted_devices (user_id, token_hash);
CREATE INDEX IF NOT EXISTS trusted_devices_user_idx ON trusted_devices (user_id);

CREATE TABLE IF NOT EXISTS security_audit_events (
  id uuid PRIMARY KEY,
  user_id text REFERENCES users (id) ON DELETE SET NULL,
  workspace_id text,
  type text NOT NULL,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_audit_events_user_created_idx
  ON security_audit_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS security_audit_events_type_created_idx
  ON security_audit_events (type, created_at);
