-- Plan 14 fix — oauth_consents must NOT be unique on (user_id, client_id).
-- The oidc-provider plugin `create`s a new consent row (never upserts) whenever
-- the requested scopes are not a subset of the stored consent, or the client
-- sends `prompt=consent`. A unique index turns every re-consent into a 500 and
-- permanently breaks MCP OAuth for that user/client pair.
DROP INDEX IF EXISTS "oauth_consents_user_client_uidx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_consents_user_client_idx"
  ON "oauth_consents" USING btree ("user_id","client_id");
