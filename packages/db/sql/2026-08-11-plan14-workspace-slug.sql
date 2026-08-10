-- Plan 14 stage 3 — backfill workspaces.slug, then tighten it.
-- Split from stage 2 so each push is non-interactive: adding a NOT NULL UNIQUE
-- column to a table with existing rows is what made drizzle-kit offer to
-- truncate the table.
UPDATE "workspaces" SET "slug" = 'default' WHERE "slug" IS NULL;
--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "slug" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_slug_unique" UNIQUE("slug");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
