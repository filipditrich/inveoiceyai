import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { Entitlements } from "./entitlements";

/**
 * Commercial packages (ADR 0035). One plan has many workspaces — that is the
 * whole point of the table. A sponsored cohort (fifteen contractors, fifteen
 * isolated workspaces) shares one row, so adding a client to bill or changing
 * the AI allowance is one edit rather than fifteen copies that drift.
 *
 * Lives in its own module for the same reason `workspaces.ts` does:
 * `workspaces.ts` references it, and `schema.ts` / `auth-schema.ts` reference
 * `workspaces.ts`. This module must therefore import nothing but types.
 */
export const plans = pgTable(
  "plans",
  {
    id: text("id").primaryKey(),
    /** Stable identifier for seeds and support (`free`, `pro`, `nfctron`, …). */
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    /** `builtin` rows are seeded and upgraded; `custom` rows are hand-made. */
    kind: text("kind").$type<"builtin" | "custom">().notNull(),
    entitlements: jsonb("entitlements").notNull().$type<Entitlements>(),
    /**
     * Verified email domains that land a newly created workspace on this plan.
     * Matched against the owner at bootstrap, on every workspace they create.
     */
    autoAssignEmailDomains: text("auto_assign_email_domains")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Where a workspace lands with no matching rule. Exactly one row is true. */
    isDefault: boolean("is_default").notNull().default(false),
    /** Archived plans keep their workspaces but stop matching and stop listing. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    /**
     * Exactly one default. A partial unique index rather than a check
     * constraint, because the invariant is across rows.
     */
    uniqueIndex("plans_single_default_uidx")
      .on(t.isDefault)
      .where(sql`${t.isDefault}`),
    index("plans_kind_idx").on(t.kind),
  ],
);

export type PlanRow = typeof plans.$inferSelect;
