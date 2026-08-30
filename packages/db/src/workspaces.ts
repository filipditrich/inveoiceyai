import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type { EntitlementOverrides } from "./entitlements";
import { plans } from "./plans";

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
export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    metadata: text("metadata"),
    /**
     * The workspace's commercial package (ADR 0035). `RESTRICT`, not `CASCADE`:
     * deleting a plan that still has workspaces must fail loudly rather than
     * orphan tenants. Archive the plan instead.
     */
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    /**
     * Per-workspace deviation from the plan, merged over it at resolve time.
     * The exception for a genuine one-off — the plan row is the mechanism for
     * anything shared, or it drifts.
     */
    entitlementOverrides: jsonb(
      "entitlement_overrides",
    ).$type<EntitlementOverrides>(),
    planAssignedAt: timestamp("plan_assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /**
     * Platform admin who assigned it; null means the domain rule did. No FK to
     * `users`: `auth-schema.ts` imports this module, so referencing it back
     * would make the pair circular.
     */
    planAssignedBy: text("plan_assigned_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("workspaces_plan_idx").on(t.planId)],
);
