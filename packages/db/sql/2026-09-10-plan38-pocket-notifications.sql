-- Plan 38 Invoicey Pocket: paired iPhones and durable notification delivery.

CREATE TABLE IF NOT EXISTS pocket_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL,
  token_fingerprint text NOT NULL,
  apns_token text,
  apns_environment text CONSTRAINT pocket_devices_apns_environment_check
    CHECK (apns_environment IS NULL OR apns_environment IN ('sandbox', 'production')),
  push_enabled boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pocket_devices_token_hash_uidx
  ON pocket_devices (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS pocket_devices_apns_token_uidx
  ON pocket_devices (apns_token) WHERE apns_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS pocket_devices_user_idx ON pocket_devices (user_id);
CREATE INDEX IF NOT EXISTS pocket_devices_workspace_idx ON pocket_devices (workspace_id);

CREATE TABLE IF NOT EXISTS pocket_pair_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  code_challenge text NOT NULL,
  redirect_uri text NOT NULL,
  device_name text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pocket_pair_grants_code_hash_uidx
  ON pocket_pair_grants (code_hash);
CREATE INDEX IF NOT EXISTS pocket_pair_grants_user_idx ON pocket_pair_grants (user_id);

CREATE TABLE IF NOT EXISTS notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  type text NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  dedupe_key text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_dedupe_uidx
  ON notification_events (dedupe_key);
CREATE INDEX IF NOT EXISTS notification_events_pending_idx
  ON notification_events (processed_at, occurred_at);
CREATE INDEX IF NOT EXISTS notification_events_workspace_idx
  ON notification_events (workspace_id, occurred_at);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES notification_events (id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  device_id uuid REFERENCES pocket_devices (id) ON DELETE SET NULL,
  channel text NOT NULL CONSTRAINT notification_deliveries_channel_check
    CHECK (channel IN ('in_app', 'push')),
  destination_key text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  action_path text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CONSTRAINT notification_deliveries_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_device_check
    CHECK ((channel = 'push' AND device_id IS NOT NULL) OR channel = 'in_app')
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_deliveries_target_uidx
  ON notification_deliveries (event_id, user_id, channel, destination_key);
CREATE INDEX IF NOT EXISTS notification_deliveries_pending_idx
  ON notification_deliveries (channel, status, next_attempt_at, lease_until);
CREATE INDEX IF NOT EXISTS notification_deliveries_inbox_idx
  ON notification_deliveries (user_id, channel, created_at);
