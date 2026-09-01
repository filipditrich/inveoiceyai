import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  type AnyPgColumn,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";
import { plans } from "./plans";
import { workspaces } from "./workspaces";

export * from "./ai-usage";
export * from "./auth-schema";
export * from "./drive-schema";
export * from "./plans";
export * from "./referral-schema";
export * from "./security-schema";
export * from "./workspaces";

/** Client row — `snapshot` holds validated ClientSnapshot JSON (Plan 4). */
/**
 * A plan's managed client catalog (ADR 0036). Entries are materialized into
 * every workspace on the plan rather than read across workspaces, so tenancy
 * stays a single `workspace_id` predicate everywhere.
 */
export const planClients = pgTable(
  "plan_clients",
  {
    id: uuid("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    /** Normalized to digits — the identity clients are already deduped on. */
    ico: text("ico").notNull(),
    /** Same shape as `clients.snapshot`; seeded from ARES. */
    snapshot: jsonb("snapshot").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("plan_clients_plan_ico_uidx").on(t.planId, t.ico)],
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** `"ares"` | `"manual"` | `"import"` */
    source: text("source").notNull(),
    snapshot: jsonb("snapshot").notNull().$type<Record<string, unknown>>(),
    /**
     * Non-null marks this row as coming from the plan's managed catalog
     * (ADR 0036). Under `clients.createMode: "managed"` it is also what makes
     * the client billable at all. `set null` on delete rather than cascade:
     * dropping a catalog entry must not delete a counterparty the workspace
     * has already invoiced.
     */
    planClientId: uuid("plan_client_id").references(
      (): AnyPgColumn => planClients.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("clients_workspace_updated_idx").on(t.workspaceId, t.updatedAt),
    index("clients_plan_client_idx").on(t.planClientId),
    /**
     * One client per IČO per workspace. Run mergeDuplicateClients (or clean
     * dupes) before applying this index in production.
     */
    uniqueIndex("clients_workspace_ico_uidx")
      .using(
        "btree",
        t.workspaceId,
        sql`regexp_replace(coalesce(${t.snapshot}->>'ico', ''), '\\D', '', 'g')`,
      )
      .where(
        sql`regexp_replace(coalesce(${t.snapshot}->>'ico', ''), '\\D', '', 'g') <> ''`,
      ),
    /**
     * Concurrency backstop for clients created without IČO. Application-level
     * resolution uses this same normalized legal-name + address identity.
     */
    uniqueIndex("clients_workspace_address_identity_uidx")
      .using(
        "btree",
        t.workspaceId,
        sql`lower(regexp_replace(btrim(coalesce(${t.snapshot}->>'name', '')), '\\s+', ' ', 'g'))`,
        sql`lower(regexp_replace(btrim(coalesce(${t.snapshot}->'address'->>'street', '')), '\\s+', ' ', 'g'))`,
        sql`lower(regexp_replace(btrim(coalesce(${t.snapshot}->'address'->>'city', '')), '\\s+', ' ', 'g'))`,
        sql`lower(regexp_replace(btrim(coalesce(${t.snapshot}->'address'->>'zip', '')), '\\s+', '', 'g'))`,
        sql`lower(btrim(coalesce(${t.snapshot}->'address'->>'country', '')))`,
      )
      .where(
        sql`regexp_replace(coalesce(${t.snapshot}->>'ico', ''), '\\D', '', 'g') = '' AND btrim(coalesce(${t.snapshot}->>'name', '')) <> '' AND btrim(coalesce(${t.snapshot}->'address'->>'street', '')) <> '' AND btrim(coalesce(${t.snapshot}->'address'->>'city', '')) <> '' AND btrim(coalesce(${t.snapshot}->'address'->>'zip', '')) <> '' AND btrim(coalesce(${t.snapshot}->'address'->>'country', '')) <> ''`,
      ),
  ],
);

/** Issuer email defaults — applied at send time. */
export type IssuerEmailSettings = {
  defaultSubject?: string;
  defaultCoverText?: string;
  attachIsdocByDefault?: boolean;
  displayNameTemplate?: string;
  filenameTemplate?: string;
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
    /** Workspace default for Eve / MCP / in-app AI drafts. */
    isDefault: boolean("is_default").default(false).notNull(),
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
    uniqueIndex("issuer_businesses_workspace_default_uidx")
      .on(t.workspaceId)
      .where(sql`${t.isDefault}`),
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
    uniqueIndex("issuer_numbering_schemes_issuer_doc").on(
      t.issuerId,
      t.docType,
    ),
    index("issuer_numbering_schemes_workspace_idx").on(t.workspaceId),
  ],
);

/** Saved invoice payload for recurrence (Plan 10). Dates/number ignored at materialize. */
export const invoiceTemplates = pgTable(
  "invoice_templates",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    issuerId: uuid("issuer_id")
      .notNull()
      .references(() => issuerBusinesses.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    name: text("name").notNull(),
    /** invoice only in v1 */
    docType: text("doc_type").notNull(),
    paymentDueDays: integer("payment_due_days").notNull(),
    payloadJson: jsonb("payload_json")
      .notNull()
      .$type<Record<string, unknown>>(),
    sourceInvoiceId: uuid("source_invoice_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("invoice_templates_workspace_name").on(t.workspaceId, t.name),
    index("invoice_templates_workspace_idx").on(t.workspaceId),
  ],
);

/** Versioned workspace look documents (Plan 28). First-party looks stay in repo. */
export const workspaceLooks = pgTable(
  "workspace_looks",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    lookId: text("look_id").notNull(),
    version: text("version").notNull(),
    document: jsonb("document").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("workspace_looks_workspace_look_version").on(
      t.workspaceId,
      t.lookId,
      t.version,
    ),
    index("workspace_looks_workspace_idx").on(t.workspaceId),
  ],
);

/** Published community look documents (Plan 29). Unpublished rows stay for slug ownership. */
export const communityLooks = pgTable(
  "community_looks",
  {
    id: uuid("id").primaryKey(),
    lookId: text("look_id").notNull(),
    version: text("version").notNull(),
    document: jsonb("document").notNull().$type<Record<string, unknown>>(),
    publisherWorkspaceId: text("publisher_workspace_id").notNull(),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("community_looks_look_version").on(t.lookId, t.version),
    index("community_looks_publisher_idx").on(t.publisherWorkspaceId),
  ],
);

/** 1:1 schedule for a template. `last_invoice_id` has no FK (cycle with invoices). */
export const recurringSchedules = pgTable(
  "recurring_schedules",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => invoiceTemplates.id, { onDelete: "cascade" }),
    /** weekly | monthly | quarterly | yearly */
    cadence: text("cadence").notNull(),
    dayOfMonth: integer("day_of_month").notNull(),
    nextRunOn: text("next_run_on").notNull(),
    paused: integer("paused").notNull().default(0),
    lastRunOn: text("last_run_on"),
    lastInvoiceId: uuid("last_invoice_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("recurring_schedules_template").on(t.templateId),
    index("recurring_schedules_due_idx").on(t.paused, t.nextRunOn),
    index("recurring_schedules_workspace_idx").on(t.workspaceId),
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
    /** Denormalized allocation projection; the ledger remains authoritative. */
    paidAmount: numeric("paid_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    /** unpaid | partial | paid | overpaid */
    paymentState: text("payment_state").notNull().default("unpaid"),
    /** Immutable payment identifiers copied from the invoice payload. */
    paymentAccountIban: text("payment_account_iban"),
    paymentVariableSymbol: text("payment_variable_symbol"),
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
    lookId: text("look_id"),
    lookVersion: text("look_version"),
    /** Canonical issued PDF (ISDOC.PDF) URL — set at issue / lazy backfill. */
    pdfUrl: text("pdf_url"),
    /** Standalone ISDOC XML URL — set at issue / lazy backfill. */
    isdocUrl: text("isdoc_url"),
    /** SHA-256 of the immutable issued PDF bytes (hex). */
    pdfSha256: text("pdf_sha256"),
    /** SHA-256 of the immutable issued ISDOC bytes (hex). */
    isdocSha256: text("isdoc_sha256"),
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
    recurringScheduleId: uuid("recurring_schedule_id").references(
      () => recurringSchedules.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("invoices_issuer_number").on(t.issuerId, t.number),
    index("invoices_workspace_issue_date_idx").on(t.workspaceId, t.issueDate),
    index("invoices_workspace_issuer_idx").on(t.workspaceId, t.issuerId),
    index("invoices_workspace_client_idx").on(t.workspaceId, t.clientId),
    index("invoices_workspace_due_date_idx").on(t.workspaceId, t.dueDate),
    index("invoices_workspace_batch_idx").on(t.workspaceId, t.importBatchId),
    index("invoices_workspace_external_key_idx").on(
      t.workspaceId,
      t.externalKey,
    ),
    index("invoices_recurring_schedule_idx").on(t.recurringScheduleId),
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

/** Workspace-owned, encrypted read-only bank integration. */
export const bankConnections = pgTable(
  "bank_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("active"),
    /** Opt-in: confirm only blocker-free, exact matcher proposals. */
    autoConfirmExactMatches: boolean("auto_confirm_exact_matches")
      .notNull()
      .default(false),
    secretCiphertext: text("secret_ciphertext").notNull(),
    secretFingerprint: text("secret_fingerprint").notNull(),
    keyVersion: integer("key_version").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    lastRotatedByUserId: text("last_rotated_by_user_id").references(
      () => user.id,
      { onDelete: "set null" },
    ),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    syncCoverageThrough: text("sync_coverage_through"),
    lastRequestAt: timestamp("last_request_at", { withTimezone: true }),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    lastSyncStartedAt: timestamp("last_sync_started_at", {
      withTimezone: true,
    }),
    lastSyncSucceededAt: timestamp("last_sync_succeeded_at", {
      withTimezone: true,
    }),
    lastSyncErrorCode: text("last_sync_error_code"),
    nextSyncAt: timestamp("next_sync_at", { withTimezone: true }),
    consecutiveFailureCount: integer("consecutive_failure_count")
      .notNull()
      .default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("bank_connections_workspace_idx").on(t.workspaceId, t.createdAt),
    index("bank_connections_sync_idx").on(t.status, t.nextSyncAt),
    uniqueIndex("bank_connections_workspace_secret_uidx").on(
      t.workspaceId,
      t.provider,
      t.secretFingerprint,
    ),
  ],
);

/** Bank account discovered through a connection. */
export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => bankConnections.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    accountNumber: text("account_number").notNull(),
    bankCode: text("bank_code").notNull(),
    iban: text("iban").notNull(),
    bic: text("bic"),
    currency: text("currency").notNull(),
    displayName: text("display_name"),
    importScope: text("import_scope").notNull().default("incoming"),
    balance: numeric("balance", { precision: 18, scale: 2 }),
    balanceAvailable: numeric("balance_available", {
      precision: 18,
      scale: 2,
    }),
    balanceUpdatedAt: timestamp("balance_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("bank_accounts_provider_iban_uidx").on(t.provider, t.iban),
    uniqueIndex("bank_accounts_connection_provider_id_uidx").on(
      t.connectionId,
      t.providerAccountId,
    ),
    index("bank_accounts_workspace_idx").on(t.workspaceId),
  ],
);

/** Issuers whose invoices may be reconciled against a bank account. */
export const bankAccountIssuers = pgTable(
  "bank_account_issuers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => bankAccounts.id, { onDelete: "cascade" }),
    issuerId: uuid("issuer_id")
      .notNull()
      .references(() => issuerBusinesses.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("bank_account_issuers_account_issuer_uidx").on(
      t.bankAccountId,
      t.issuerId,
    ),
    index("bank_account_issuers_workspace_idx").on(t.workspaceId),
  ],
);

/** Provider-normalized bank statement row. Provider payloads are not retained. */
export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => bankAccounts.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerTransactionId: text("provider_transaction_id").notNull(),
    bookedDate: text("booked_date").notNull(),
    valueDate: text("value_date"),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    direction: text("direction").notNull(),
    counterpartyAccount: text("counterparty_account"),
    counterpartyBankCode: text("counterparty_bank_code"),
    counterpartyIban: text("counterparty_iban"),
    counterpartyName: text("counterparty_name"),
    variableSymbol: text("variable_symbol"),
    constantSymbol: text("constant_symbol"),
    specificSymbol: text("specific_symbol"),
    message: text("message"),
    transactionType: text("transaction_type"),
    providerReference: text("provider_reference"),
    payloadHash: text("payload_hash").notNull(),
    possibleReversalOfId: uuid("possible_reversal_of_id"),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("bank_transactions_account_provider_id_uidx").on(
      t.bankAccountId,
      t.providerTransactionId,
    ),
    index("bank_transactions_workspace_booked_idx").on(
      t.workspaceId,
      t.bookedDate,
    ),
    index("bank_transactions_match_idx").on(
      t.bankAccountId,
      t.variableSymbol,
      t.amount,
    ),
  ],
);

/** Explainable, versioned suggestion; it never mutates invoice state by itself. */
export const paymentMatchProposals = pgTable(
  "payment_match_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    bankTransactionId: uuid("bank_transaction_id")
      .notNull()
      .references(() => bankTransactions.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    proposedAmount: numeric("proposed_amount", {
      precision: 18,
      scale: 2,
    }).notNull(),
    score: integer("score").notNull(),
    confidence: text("confidence").notNull(),
    reasonCodes: jsonb("reason_codes").$type<string[]>().notNull(),
    blockerCodes: jsonb("blocker_codes").$type<string[]>().notNull(),
    matcherVersion: text("matcher_version").notNull(),
    status: text("status").notNull().default("pending"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("payment_match_proposals_version_uidx").on(
      t.bankTransactionId,
      t.invoiceId,
      t.matcherVersion,
    ),
    index("payment_match_proposals_workspace_status_idx").on(
      t.workspaceId,
      t.status,
    ),
  ],
);

/** Authoritative, append-oriented money allocation ledger. */
export const invoicePaymentAllocations = pgTable(
  "invoice_payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    bankTransactionId: uuid("bank_transaction_id").references(
      () => bankTransactions.id,
      { onDelete: "restrict" },
    ),
    proposalId: uuid("proposal_id").references(() => paymentMatchProposals.id, {
      onDelete: "set null",
    }),
    source: text("source").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    effectiveDate: text("effective_date").notNull(),
    confirmedByUserId: text("confirmed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversedByUserId: text("reversed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reversalReason: text("reversal_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("invoice_payment_allocations_invoice_idx").on(
      t.workspaceId,
      t.invoiceId,
    ),
    index("invoice_payment_allocations_transaction_idx").on(
      t.bankTransactionId,
    ),
    uniqueIndex("invoice_payment_allocations_transaction_invoice_uidx")
      .on(t.bankTransactionId, t.invoiceId)
      .where(sql`${t.reversedAt} IS NULL`),
    uniqueIndex("invoice_payment_allocations_legacy_invoice_uidx")
      .on(t.invoiceId)
      .where(sql`${t.source} = 'legacy_manual' AND ${t.reversedAt} IS NULL`),
  ],
);

/** Append-only human/system trail for sensitive reconciliation operations. */
export const paymentAuditEvents = pgTable(
  "payment_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    actorType: text("actor_type").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    payloadJson: jsonb("payload_json")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("payment_audit_events_workspace_created_idx").on(
      t.workspaceId,
      t.createdAt,
    ),
    index("payment_audit_events_entity_idx").on(t.entityType, t.entityId),
  ],
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
