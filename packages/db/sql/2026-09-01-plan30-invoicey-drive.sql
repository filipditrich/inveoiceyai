-- Plan 30 Invoicey Drive: user layout, paired Macs, one-time pair grants.

CREATE TABLE IF NOT EXISTS drive_user_settings (
  user_id text PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  layout_template text NOT NULL DEFAULT '{year}/{kind}_{number}',
  include_isdoc boolean NOT NULL DEFAULT false,
  hidden_workspace_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drive_devices (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL,
  token_fingerprint text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS drive_devices_token_hash_uidx
  ON drive_devices (token_hash);

CREATE INDEX IF NOT EXISTS drive_devices_user_idx
  ON drive_devices (user_id);

CREATE TABLE IF NOT EXISTS drive_pair_grants (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  code_challenge text NOT NULL,
  redirect_uri text NOT NULL,
  device_name text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS drive_pair_grants_code_hash_uidx
  ON drive_pair_grants (code_hash);

CREATE INDEX IF NOT EXISTS drive_pair_grants_user_idx
  ON drive_pair_grants (user_id);
