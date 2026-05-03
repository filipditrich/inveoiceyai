import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Persisted CRM contact aligned with `@invoicey/invoice-core` `ClientSnapshotSchema`
 * (`snapshot` column stores validated JSON — see Plan 4).
 */
export const clients = pgTable("clients", {
	id: uuid("id").defaultRandom().primaryKey(),
	workspaceId: text("workspace_id").notNull(),
	/** `"ares"` | `"manual"` */
	source: text("source").notNull(),
	snapshot: jsonb("snapshot").notNull().$type<Record<string, unknown>>(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});
