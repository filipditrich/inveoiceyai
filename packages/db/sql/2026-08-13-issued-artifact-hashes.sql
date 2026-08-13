-- Integrity metadata for immutable native issued artifacts.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS pdf_sha256 text;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS isdoc_sha256 text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_pdf_sha256_format'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_pdf_sha256_format
      CHECK (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[0-9a-f]{64}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_isdoc_sha256_format'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_isdoc_sha256_format
      CHECK (isdoc_sha256 IS NULL OR isdoc_sha256 ~ '^[0-9a-f]{64}$');
  END IF;
END $$;
