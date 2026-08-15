ALTER TABLE bank_connections
ADD COLUMN IF NOT EXISTS auto_confirm_exact_matches boolean NOT NULL DEFAULT false;
