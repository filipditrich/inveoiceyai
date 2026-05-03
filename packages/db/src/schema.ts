import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Client row — `snapshot` holds validated ClientSnapshot JSON (Plan 4). */
export const clients = pgTable("clients", {
	id: uuid("id").primaryKey(),
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
