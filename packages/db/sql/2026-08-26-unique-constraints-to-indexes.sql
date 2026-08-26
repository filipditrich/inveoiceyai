-- Fix the drizzle-kit false positive that made `db:push` unrunnable
--
-- `bun db:push` repeatedly offered to TRUNCATE issuer_numbering_schemes (24
-- rows) and invoices (116 rows) in order to "add" unique constraints that
-- already existed, identically defined. Answering yes would have destroyed
-- data, and drizzle-kit refuses to run non-interactively, so the documented
-- workaround was to hand-apply every schema change instead.
--
-- Cause: drizzle-kit 0.31 does not match **composite** `unique(name).on(a, b)`
-- constraints against what it introspects from Postgres. Every single-column
-- unique in this database compares fine; the only two it re-proposed were the
-- two composite ones. It does match `uniqueIndex()` correctly — the schema is
-- full of those and none of them drift.
--
-- Fix: express both as unique indexes instead, in the database and in
-- src/schema.ts. Enforcement is identical in Postgres, no rows change, and
-- nothing references either as a foreign key (checked).
--
-- Names are kept so existing references stay valid.

BEGIN;

ALTER TABLE issuer_numbering_schemes
  DROP CONSTRAINT IF EXISTS issuer_numbering_schemes_issuer_doc;
CREATE UNIQUE INDEX IF NOT EXISTS issuer_numbering_schemes_issuer_doc
  ON issuer_numbering_schemes (issuer_id, doc_type);

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_issuer_number;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_issuer_number
  ON invoices (issuer_id, number);

COMMIT;

-- Second drift, different cause: `key: text("key").notNull().unique()` has no
-- explicit name, so drizzle derives `rate_limits_key_unique`. The constraint
-- was created by raw SQL as an inline UNIQUE, so Postgres named it
-- `rate_limits_key_key`. Same constraint, different name — rename to what the
-- schema implies rather than pinning the Postgres name in code.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rate_limits_key_key'
      AND conrelid = 'rate_limits'::regclass
  ) THEN
    ALTER TABLE rate_limits
      RENAME CONSTRAINT rate_limits_key_key TO rate_limits_key_unique;
  END IF;
END $$;

-- Drop the orphaned Fio payment-submission columns.
--
-- These backed the "enable payment submission" flow on Settings → Bank
-- connections, which existed only to feed payment runs. Payment runs went with
-- the payables removal, so the UI promised a capability nothing could use.
-- The connection is read-only now, and access_mode has no second value left to
-- hold.

ALTER TABLE bank_connections
  DROP COLUMN IF EXISTS access_mode,
  DROP COLUMN IF EXISTS payment_secret_ciphertext,
  DROP COLUMN IF EXISTS payment_secret_fingerprint,
  DROP COLUMN IF EXISTS payment_key_version,
  DROP COLUMN IF EXISTS payment_token_expires_at,
  DROP COLUMN IF EXISTS payment_last_request_at,
  DROP COLUMN IF EXISTS payment_enabled_at,
  DROP COLUMN IF EXISTS payment_enabled_by_user_id;

ALTER TABLE bank_connections DROP CONSTRAINT IF EXISTS bank_connections_access_check;
