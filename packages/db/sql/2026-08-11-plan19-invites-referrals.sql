-- Plan 19: referral attribution columns + event log (ADR 0025).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by_user_id text;

CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_uidx
  ON users (referral_code)
  WHERE referral_code IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_referred_by_user_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_referred_by_user_id_fkey
      FOREIGN KEY (referred_by_user_id)
      REFERENCES users (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code text NOT NULL,
  type text NOT NULL,
  referred_user_id text REFERENCES users (id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_events_referrer_created_idx
  ON referral_events (referrer_user_id, created_at);
CREATE INDEX IF NOT EXISTS referral_events_code_created_idx
  ON referral_events (code, created_at);
CREATE INDEX IF NOT EXISTS referral_events_type_created_idx
  ON referral_events (type, created_at);
