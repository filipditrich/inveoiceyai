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
    /**
     * Who may change `plan_id` (ADR 0047). `manual` is admin / domain /
     * grandfathered. `polar` is a verified Polar subscription.
     */
    billingAuthority: text("billing_authority")
      .$type<"manual" | "polar">()
      .notNull()
      .default("manual"),
    defaultLookId: text("default_look_id").notNull().default("classic"),
    defaultLookVersion: text("default_look_version").notNull().default("1.0.0"),
    /**
     * Occupancy hold (ADR 0046). Null = live. Not an entitlement — freeze
     * fails closed on writes even if the plan would otherwise allow them.
     */
    frozenAt: timestamp("frozen_at", { withTimezone: true }),
    frozenBy: text("frozen_by"),
    freezeReason: text("freeze_reason"),
    /**
     * Guest issuance (Plan 34, ADR 0048). **A workspace is an ordinary tenant
     * iff `unclaimedSince` is null** — that single-column predicate is what
     * every cross-tenant query, admin metric, and plan count filters on
     * (`notUnclaimedWorkspaces()` in `guest-issuance.ts`). The four columns
     * below only ever have values together: a guest row is created with all
     * of them (`unclaimedSince` set, the rest null) and claiming flips them
     * atomically (`claimGuestWorkspace` in `guest-repo.ts`).
     */
    guestEmail: text("guest_email"),
    unclaimedSince: timestamp("unclaimed_since", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    /** Claiming user id. No FK, mirrors `planAssignedBy` above. */
    claimedBy: text("claimed_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("workspaces_plan_idx").on(t.planId),
    index("workspaces_frozen_idx").on(t.frozenAt),
    index("workspaces_unclaimed_idx").on(t.unclaimedSince),
  ],
);
