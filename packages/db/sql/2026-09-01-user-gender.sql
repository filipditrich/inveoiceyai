-- Grammatical gender for PDF footer verbs (Vystavil / Vystavila / Vystavil(a)).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT 'unspecified';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_gender_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_gender_check
      CHECK (gender IN ('him', 'her', 'unspecified'));
  END IF;
END $$;
