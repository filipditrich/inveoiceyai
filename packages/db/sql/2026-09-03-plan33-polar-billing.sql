-- Plan 33 — Polar billing for plans and AI-token top-ups (ADR 0047).
-- Idempotent. Apply with the SQL runner or `bun db:push` from the Drizzle schema.

BEGIN;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS billing_authority text NOT NULL DEFAULT 'manual';

ALTER TABLE workspaces
  DROP CONSTRAINT IF EXISTS workspaces_billing_authority_check;

ALTER TABLE workspaces
  ADD CONSTRAINT workspaces_billing_authority_check
  CHECK (billing_authority IN ('manual', 'polar'));

CREATE TABLE IF NOT EXISTS billing_customers (
  workspace_id          text PRIMARY KEY REFERENCES workspaces (id) ON DELETE CASCADE,
  provider              text NOT NULL DEFAULT 'polar',
  environment           text NOT NULL,
  provider_customer_id  text NOT NULL UNIQUE,
  provider_external_id  text NOT NULL UNIQUE,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id                        uuid PRIMARY KEY,
  workspace_id              text NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  provider                  text NOT NULL DEFAULT 'polar',
  provider_subscription_id  text NOT NULL UNIQUE,
  provider_product_id       text NOT NULL,
  offer_key                 text NOT NULL,
  status                    text NOT NULL,
  cancel_at_period_end      boolean NOT NULL DEFAULT false,
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  ends_at                   timestamptz,
  ended_at                  timestamptz,
  provider_modified_at      timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_subscriptions_workspace_idx
  ON billing_subscriptions (workspace_id);

CREATE TABLE IF NOT EXISTS billing_orders (
  id                   uuid PRIMARY KEY,
  workspace_id         text NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  provider             text NOT NULL DEFAULT 'polar',
  provider_order_id    text NOT NULL UNIQUE,
  provider_product_id  text NOT NULL,
  offer_key            text NOT NULL,
  billing_reason       text NOT NULL,
  amount               integer NOT NULL,
  currency             text NOT NULL,
  refunded_amount      integer NOT NULL DEFAULT 0,
  checkout_id          text,
  status               text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_orders_workspace_idx
  ON billing_orders (workspace_id);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id                 uuid PRIMARY KEY,
  provider           text NOT NULL DEFAULT 'polar',
  provider_event_id  text NOT NULL UNIQUE,
  event_type         text NOT NULL,
  payload            jsonb NOT NULL,
  state              text NOT NULL,
  error              text,
  received_at        timestamptz NOT NULL DEFAULT now(),
  processed_at       timestamptz
);

CREATE INDEX IF NOT EXISTS billing_webhook_events_type_idx
  ON billing_webhook_events (event_type, received_at);

CREATE TABLE IF NOT EXISTS billing_token_adjustments (
  id                  uuid PRIMARY KEY,
  workspace_id        text NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  provider_order_id   text NOT NULL,
  kind                text NOT NULL,
  tokens              bigint NOT NULL,
  idempotency_key     text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_token_adjustments_idem_uidx
  ON billing_token_adjustments (idempotency_key);

CREATE INDEX IF NOT EXISTS billing_token_adjustments_order_idx
  ON billing_token_adjustments (workspace_id, provider_order_id);

COMMIT;
