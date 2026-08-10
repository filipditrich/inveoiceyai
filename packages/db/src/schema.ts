import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Workspace registry (ADR 0007) — also the Better Auth `organization` model,
 * remapped in the adapter config rather than mirrored (ADR 0019). That makes
 * `session.activeOrganizationId` the exact value every `workspace_id` filter
 * uses, so there is one tenancy id and no translation step.
 *
 * `id` is text so it matches `workspace_id` columns (UUID strings).
 * `slug` is nullable until the backfill lands (see Plan 14 stage 3).
 */
export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Client row — `snapshot` holds validated ClientSnapshot JSON (Plan 4). */
export const clients = pgTable(
  "clients",
  {
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
  },
  (t) => [
    index("clients_workspace_updated_idx").on(t.workspaceId, t.updatedAt),
  ],
);

/** Issuer (my-business) row — `snapshot` holds validated IssuerSnapshot JSON (Plan 5). */
export const issuerBusinesses = pgTable(
  "issuer_businesses",
  {
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
  },
  (t) => [
    index("issuer_businesses_workspace_updated_idx").on(
      t.workspaceId,
      t.updatedAt,
    ),
  ],
);

/** Per-(issuer, docType) numbering scheme (Plan 5 / numbering.md). */
export const issuerNumberingSchemes = pgTable(
  "issuer_numbering_schemes",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    issuerId: uuid("issuer_id")
      .notNull()
      .references(() => issuerBusinesses.id, { onDelete: "cascade" }),
    /** invoice | proforma | advance | credit_note */
    docType: text("doc_type").notNull(),
    template: text("template").notNull(),
    /** yearly | never */
    resetPeriod: text("reset_period").notNull(),
    counter: integer("counter").notNull().default(0),
    counterYear: integer("counter_year"),
    padding: integer("padding").notNull().default(4),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("issuer_numbering_schemes_issuer_doc").on(t.issuerId, t.docType),
    index("issuer_numbering_schemes_workspace_idx").on(t.workspaceId),
  ],
);

/**
 * Invoice header — facts for deriveStatus + payload_json for round-trip/PDF.
 * `number` null while draft; unique (issuer_id, number) allows many null drafts.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    issuerId: uuid("issuer_id")
      .notNull()
      .references(() => issuerBusinesses.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    /** invoice | proforma | advance | credit_note */
    docType: text("doc_type").notNull(),
    number: text("number"),
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date").notNull(),
    duzp: text("duzp"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    currency: text("currency").notNull().default("CZK"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    vatTotal: numeric("vat_total", { precision: 14, scale: 2 }).notNull(),
    clientName: text("client_name").notNull(),
    notes: text("notes"),
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
    unique("invoices_issuer_number").on(t.issuerId, t.number),
    index("invoices_workspace_issue_date_idx").on(t.workspaceId, t.issueDate),
    index("invoices_workspace_issuer_idx").on(t.workspaceId, t.issuerId),
    index("invoices_workspace_client_idx").on(t.workspaceId, t.clientId),
    index("invoices_workspace_due_date_idx").on(t.workspaceId, t.dueDate),
  ],
);

/** Line items denormalized for querying; canonical lines also live in payload_json. */
export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unit: text("unit").notNull(),
    unitPriceWithoutVat: numeric("unit_price_without_vat", {
      precision: 14,
      scale: 4,
    }).notNull(),
    vatRate: text("vat_rate").notNull(),
    lineSubtotal: numeric("line_subtotal", {
      precision: 14,
      scale: 2,
    }).notNull(),
    lineVat: numeric("line_vat", { precision: 14, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)],
);

/**
 * Slack account -> Invoicey user + workspace (Plan 14, ADR 0020).
 * One Slack account maps to exactly one user and one workspace; re-linking
 * updates the row. Unlinked Slack users can do nothing.
 */
export const slackIdentities = pgTable(
  "slack_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slackTeamId: text("slack_team_id").notNull(),
    slackUserId: text("slack_user_id").notNull(),
    userId: text("user_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("slack_identities_team_user_uidx").on(
      t.slackTeamId,
      t.slackUserId,
    ),
    index("slack_identities_user_idx").on(t.userId),
  ],
);

/**
 * Short-lived single-use codes backing the Slack link flow.
 * Deliberately not Better Auth's `verification` table — that one is
 * library-owned and has its own cleanup semantics.
 */
export const slackLinkCodes = pgTable(
  "slack_link_codes",
  {
    code: text("code").primaryKey(),
    slackTeamId: text("slack_team_id").notNull(),
    slackUserId: text("slack_user_id").notNull(),
    slackUserName: text("slack_user_name"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("slack_link_codes_slack_user_idx").on(t.slackTeamId, t.slackUserId),
  ],
);

/** Durable MCP/Slack presets (`issuer` | `invoice_template`). */
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

/**
 * Better Auth tables. Re-exported last so `workspaces` is initialised before
 * `auth-schema` (which references it) evaluates, and so `drizzle.config.ts`
 * still only needs to point at this one file.
 */
export * from "./auth-schema";
