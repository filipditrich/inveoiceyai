import { pgTable, uuid } from "drizzle-orm/pg-core";

/**
 * Single bootstrap table so drizzle-kit push validates connectivity.
 * Drop once real workspace tables exist (Plans 4–6).
 */
export const bootstrapProbe = pgTable("bootstrap_probe", {
  id: uuid("id").defaultRandom().primaryKey(),
});
