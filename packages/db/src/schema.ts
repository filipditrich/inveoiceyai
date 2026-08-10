import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Single workspace until Clerk (Plan 14). */
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Live issuer; `snapshot` is IssuerSnapshot JSON; `ico`/`name` denormalized for filters. */
export const issuers = pgTable(
  "issuers",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    ico: text("ico").notNull(),
    vatPayer: boolean("vat_payer").notNull(),
    snapshot: jsonb("snapshot").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("issuers_workspace_ico_uidx").on(t.workspaceId, t.ico),
  ],
);

/** Per-issuer numbering template + sequence (Plan 5). */
export const issuerNumberingSchemes = pgTable(
  "issuer_numbering_schemes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issuerId: uuid("issuer_id")
      .notNull()
      .references(() => issuers.id, { onDelete: "cascade" }),
    docType: text("doc_type").notNull(),
    template: text("template").notNull(),
    nextSequence: integer("next_sequence").notNull().default(1),
    resetYear: integer("reset_year"),
  },
  (t) => [
    uniqueIndex("issuer_numbering_issuer_doc_uidx").on(t.issuerId, t.docType),
  ],
);

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

/** Invoice draft/issued; status derived from timestamps; lines in `payloadJson`. */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id").notNull(),
    issuerId: uuid("issuer_id")
      .notNull()
      .references(() => issuers.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    docType: text("doc_type").notNull(),
    number: text("number").notNull(),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    duzp: date("duzp").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("CZK"),
    issuerSnapshot: jsonb("issuer_snapshot")
      .notNull()
      .$type<Record<string, unknown>>(),
    clientSnapshot: jsonb("client_snapshot")
      .notNull()
      .$type<Record<string, unknown>>(),
    payloadJson: jsonb("payload_json")
      .notNull()
      .$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("invoices_workspace_number_uidx").on(t.workspaceId, t.number),
  ],
);

/** Durable presets (`issuer` | `invoice_template`). */
export const presets = pgTable(
  "presets",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    data: jsonb("data").notNull().$type<unknown>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("presets_workspace_kind_name_uidx").on(
      t.workspaceId,
      t.kind,
      t.name,
    ),
  ],
);
