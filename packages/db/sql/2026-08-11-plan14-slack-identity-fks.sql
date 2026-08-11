-- Plan 14 — foreign keys on slack_identities.
-- Omitted when the table was first created because schema.ts and auth-schema.ts
-- were circular at the time, so `users` was not referenceable from schema.ts.
-- The cycle is gone (workspaces moved to its own module), so the FKs can land.
DO $$ BEGIN
  ALTER TABLE "slack_identities" ADD CONSTRAINT "slack_identities_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "slack_identities" ADD CONSTRAINT "slack_identities_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
