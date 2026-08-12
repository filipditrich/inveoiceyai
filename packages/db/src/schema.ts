import { sql } from "drizzle-orm";
import {
  boolean,
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

import { user } from "./auth-schema";
import { workspaces } from "./workspaces";

export * from "./ai-usage";
export * from "./auth-schema";
export * from "./referral-schema";
export * from "./security-schema";
export * from "./workspaces";

/** Client row — `snapshot` holds validated ClientSnapshot JSON (Plan 4). */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** `"ares"` | `"manual"` | `"import"` */
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
    /**
     * One client per IČO per workspace. Run mergeDuplicateClients (or clean
     * dupes) before applying this index in production.
     */
    uniqueIndex("clients_workspace_ico_uidx")
      .using("btree", t.workspaceId, sql`(${t.snapshot}->>'ico')`)
      .where(
        sql`${t.snapshot}->>'ico' IS NOT NULL AND btrim(${t.snapshot}->>'ico') <> ''`,
      ),
  ],
);

/** Issuer email defaults — applied at send time. */
export type IssuerEmailSettings = {
  defaultSubject?: string;
  defaultCoverText?: string;
  attachIsdocByDefault?: boolean;
  displayNameTemplate?: string;
  overdueRemindersEnabled?: boolean;
  overdueReminderIntervalDays?: number;
  sendPaymentReceivedEmail?: boolean;
};

/** Issuer (my-business) row — `snapshot` holds validated IssuerSnapshot JSON (Plan 5). */
export const issuerBusinesses = pgTable(
  "issuer_businesses",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** `"ares"` | `"manual"` */
    source: text("source").notNull(),
    snapshot: jsonb("snapshot").notNull().$type<Record<string, unknown>>(),
    emailSettings: jsonb("email_settings")
      .$type<IssuerEmailSettings>()
      .default({})
      .notNull(),
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
    /** Canonical issued PDF (ISDOC.PDF) URL — set at issue / lazy backfill. */
    pdfUrl: text("pdf_url"),
    /** Standalone ISDOC XML URL — set at issue / lazy backfill. */
    isdocUrl: text("isdoc_url"),
    pdfGeneratedAt: timestamp("pdf_generated_at", { withTimezone: true }),
    /**
     * Provenance for imported invoices.
     * `invoicey` | `fakturaonline` | `idoklad` | `fakturoid` | `pohoda` |
     * `money_s3` | `vyfakturuj` | `superfaktura` | `custom`
     */
    originProvider: text("origin_provider"),
    originLabel: text("origin_label"),
    originVersion: text("origin_version"),
    /** `full` | `archive` — null means native Invoicey-issued. */
    importCompleteness: text("import_completeness"),
    importBatchId: uuid("import_batch_id"),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    /** Idempotency key (ISDOC UUID or provider+number+issueDate). */
    externalKey: text("external_key"),
    /** When true, never regenerate PDF/ISDOC over stored originals. */
    artifactsImmutable: integer("artifacts_immutable").notNull().default(0),
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
    index("invoices_workspace_batch_idx").on(t.workspaceId, t.importBatchId),
    index("invoices_workspace_external_key_idx").on(
      t.workspaceId,
      t.externalKey,
    ),
  ],
);

/** Bulk import run metadata (web historical import). */
export const invoiceImportBatches = pgTable(
  "invoice_import_batches",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    issuerId: uuid("issuer_id")
      .notNull()
      .references(() => issuerBusinesses.id),
    originProvider: text("origin_provider").notNull(),
    originLabel: text("origin_label"),
    originVersion: text("origin_version"),
    defaultPaid: integer("default_paid").notNull().default(0),
    createdCount: integer("created_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("invoice_import_batches_workspace_idx").on(
      t.workspaceId,
      t.createdAt,
    ),
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
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
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

/** Delivery status for email_messages (opens/clicks are soft signals). */
export type EmailMessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "delayed"
  | "bounced"
  | "failed"
  | "complained";

/** Outbound transactional email. */
export const emailMessages = pgTable(
  "email_messages",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    /** invoice_sent | workspace_invite | overdue_reminder | payment_received | new_sign_in */
    template: text("template").notNull(),
    toEmail: text("to_email").notNull(),
    ccEmails: jsonb("cc_emails").$type<string[]>().default([]).notNull(),
    replyTo: text("reply_to"),
    fromDisplay: text("from_display").notNull(),
    fromAddress: text("from_address").notNull(),
    subject: text("subject").notNull(),
    coverText: text("cover_text"),
    attachPdf: boolean("attach_pdf").notNull().default(false),
    attachIsdoc: boolean("attach_isdoc").notNull().default(false),
    provider: text("provider").notNull().default("resend"),
    providerMessageId: text("provider_message_id"),
    status: text("status")
      .notNull()
      .$type<EmailMessageStatus>()
      .default("queued"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("email_messages_workspace_invoice_idx").on(
      t.workspaceId,
      t.invoiceId,
    ),
    index("email_messages_provider_message_idx").on(t.providerMessageId),
    index("email_messages_workspace_created_idx").on(
      t.workspaceId,
      t.createdAt,
    ),
  ],
);

/** Append-only provider webhook events. */
export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => emailMessages.id, { onDelete: "cascade" }),
    /** sent | delivered | delivery_delayed | bounced | failed | complained | opened | clicked */
    type: text("type").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    payloadJson: jsonb("payload_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("email_events_provider_event_uidx").on(t.providerEventId),
    index("email_events_message_idx").on(t.messageId, t.occurredAt),
  ],
);

/** Bounce/complaint suppressions for automated sends. */
export const emailSuppressions = pgTable(
  "email_suppressions",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    email: text("email").notNull(),
    /** bounce | complaint */
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("email_suppressions_workspace_email_uidx").on(
      t.workspaceId,
      t.email,
    ),
  ],
);
