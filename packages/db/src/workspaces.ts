import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Workspace registry (ADR 0007) — also the Better Auth `organization` model,
 * remapped in the adapter config rather than mirrored (ADR 0019). That makes
 * `session.activeOrganizationId` the exact value every `workspace_id` filter
 * uses, so there is one tenancy id and no translation step.
 *
 * `id` is text so it matches `workspace_id` columns (UUID strings).
 *
 * Lives in its own module because both `schema.ts` (business tables) and
 * `auth-schema.ts` (members, invitations) reference it — importing it from
 * either would make those two modules circular.
 */
export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
