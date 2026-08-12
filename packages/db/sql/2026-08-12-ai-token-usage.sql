-- Workspace AI token balances + usage ledger (in-app AI / Eve / MCP activity).

CREATE TABLE IF NOT EXISTS ai_token_balances (
  workspace_id text PRIMARY KEY REFERENCES workspaces (id) ON DELETE CASCADE,
  gifted_remaining bigint NOT NULL DEFAULT 0,
  monthly_remaining bigint NOT NULL DEFAULT 0,
  monthly_limit bigint NOT NULL DEFAULT 1000000,
  purchased_remaining bigint NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  user_id text REFERENCES users (id) ON DELETE SET NULL,
  product text NOT NULL,
  kind text NOT NULL,
  model text,
  prompt_tokens bigint NOT NULL DEFAULT 0,
  completion_tokens bigint NOT NULL DEFAULT 0,
  total_tokens bigint NOT NULL DEFAULT 0,
  bucket_debited text,
  tool_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_events_workspace_created_idx
  ON ai_usage_events (workspace_id, created_at);

CREATE INDEX IF NOT EXISTS ai_usage_events_workspace_product_idx
  ON ai_usage_events (workspace_id, product);
