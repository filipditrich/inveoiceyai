import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
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
import { bankTransactions, clients, issuerBusinesses } from "./schema";
import { workspaces } from "./workspaces";

export type InboxItemSource = "email" | "upload";
export type InboxItemStatus =
  | "received"
  | "processing"
  | "processed"
  | "no_invoice"
  | "rejected"
  | "failed";

export type IncomingDocumentKind =
  "pdf" | "isdoc" | "isdocx" | "image" | "other";
export type IncomingDocumentClassification =
  | "invoice"
  | "credit_note"
  | "proforma"
  | "reminder"
  | "statement"
  | "contract"
  | "receipt"
  | "other"
  | "spam"
  | "unknown";
export type IncomingExtractionStatus =
  "pending" | "succeeded" | "failed" | "skipped";

export type IncomingInvoiceStatus =
  | "needs_review"
  | "extract_failed"
  | "accepted"
  | "pending_approval"
  | "approved"
  | "on_hold"
  | "rejected"
  | "cancelled";

export type IncomingDocType =
  "invoice" | "credit_note" | "proforma" | "advance";
export type IncomingPaymentState = "unpaid" | "partial" | "paid" | "overpaid";
export type IncomingPaymentMethod =
  "transfer" | "card" | "cash" | "direct_debit" | "other";
export type IncomingExtractionSource = "isdoc" | "isdoc_pdf" | "ai" | "manual";
export type ExtractionConfidence = "high" | "medium" | "low";

export type SupplierAddress = {
  street?: string;
  city?: string;
  zip?: string;
  country?: string;
};

export type IncomingVatBreakdownEntry = {
  rate: string;
  base: string;
  vat: string;
};

export type InboxAuthResults = {
  spf?: string;
  dkim?: string;
  dmarc?: string;
};

export type IncomingExtractionConfidence = Record<string, ExtractionConfidence>;

/** One inbound message or one upload action. */
export const inboxItems = pgTable(
  "inbox_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    source: text("source").notNull().$type<InboxItemSource>(),
    aliasId: uuid("alias_id"),
    issuerId: uuid("issuer_id").references(() => issuerBusinesses.id, {
      onDelete: "set null",
    }),
    providerMessageId: text("provider_message_id"),
    rfcMessageId: text("rfc_message_id"),
    fromAddress: text("from_address"),
    fromName: text("from_name"),
    parsedOriginalFrom: text("parsed_original_from"),
    toAddresses: jsonb("to_addresses").$type<string[]>().default([]).notNull(),
    subject: text("subject"),
    bodyText: text("body_text"),
    authResults: jsonb("auth_results").$type<InboxAuthResults>(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    status: text("status")
      .notNull()
      .$type<InboxItemStatus>()
      .default("received"),
    errorCode: text("error_code"),
    documentCount: integer("document_count").notNull().default(0),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("inbox_items_workspace_provider_uidx")
      .on(t.workspaceId, t.providerMessageId)
      .where(sql`${t.providerMessageId} is not null`),
    index("inbox_items_workspace_received_idx").on(t.workspaceId, t.receivedAt),
    index("inbox_items_workspace_status_idx").on(t.workspaceId, t.status),
  ],
);

/** Bearer inbound address. Local part is globally unique. */
export const inboxAliases = pgTable(
  "inbox_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    issuerId: uuid("issuer_id").references(() => issuerBusinesses.id, {
      onDelete: "set null",
    }),
    localPart: text("local_part").notNull(),
    label: text("label"),
    isActive: boolean("is_active").notNull().default(true),
    rotatedFromId: uuid("rotated_from_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("inbox_aliases_local_part_uidx").on(t.localPart),
    index("inbox_aliases_workspace_idx").on(t.workspaceId, t.isActive),
  ],
);

/** Immutable stored file identified by sha256. */
export const incomingDocuments = pgTable(
  "incoming_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    inboxItemId: uuid("inbox_item_id").references(() => inboxItems.id, {
      onDelete: "set null",
    }),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: text("sha256").notNull(),
    kind: text("kind").notNull().$type<IncomingDocumentKind>(),
    classification:
      text("classification").$type<IncomingDocumentClassification>(),
    classificationSource: text("classification_source"),
    extractionStatus: text("extraction_status")
      .notNull()
      .$type<IncomingExtractionStatus>()
      .default("pending"),
    extractionError: text("extraction_error"),
    retainUntil: date("retain_until"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("incoming_documents_workspace_sha256_uidx").on(
      t.workspaceId,
      t.sha256,
    ),
    index("incoming_documents_inbox_item_idx").on(t.inboxItemId),
  ],
);

/** Supplier master, separate from clients. */
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ico: text("ico"),
    dic: text("dic"),
    vatId: text("vat_id"),
    name: text("name").notNull(),
    address: jsonb("address").$type<SupplierAddress>().default({}).notNull(),
    country: text("country").notNull().default("CZ"),
    source: text("source").notNull(),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    defaultCurrency: text("default_currency"),
    paymentTermsDays: integer("payment_terms_days"),
    isTrusted: boolean("is_trusted").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("suppliers_workspace_ico_uidx")
      .on(t.workspaceId, t.ico)
      .where(sql`coalesce(${t.ico}, '') <> ''`),
    uniqueIndex("suppliers_workspace_name_uidx")
      .using(
        "btree",
        t.workspaceId,
        sql`lower(regexp_replace(btrim(${t.name}), '\\s+', ' ', 'g'))`,
        t.country,
      )
      .where(sql`coalesce(${t.ico}, '') = ''`),
    index("suppliers_workspace_updated_idx").on(t.workspaceId, t.updatedAt),
  ],
);

/** Beneficiary accounts ever seen for a supplier. */
export const supplierBankAccounts = pgTable(
  "supplier_bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    iban: text("iban"),
    accountNumber: text("account_number"),
    bankCode: text("bank_code"),
    bic: text("bic"),
    currency: text("currency"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    firstSeenDocumentId: uuid("first_seen_document_id"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedByUserId: text("confirmed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    isBlocked: boolean("is_blocked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("supplier_bank_accounts_identity_uidx").on(
      t.supplierId,
      sql`coalesce(${t.iban}, ${t.accountNumber} || '/' || ${t.bankCode})`,
    ),
    index("supplier_bank_accounts_supplier_idx").on(t.supplierId),
  ],
);

/** Supplier tax document addressed to a workspace issuer. */
export const incomingInvoices = pgTable(
  "incoming_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    issuerId: uuid("issuer_id")
      .notNull()
      .references(() => issuerBusinesses.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "restrict",
    }),
    inboxItemId: uuid("inbox_item_id").references(() => inboxItems.id, {
      onDelete: "set null",
    }),
    primaryDocumentId: uuid("primary_document_id").references(
      () => incomingDocuments.id,
      { onDelete: "set null" },
    ),
    status: text("status")
      .notNull()
      .$type<IncomingInvoiceStatus>()
      .default("needs_review"),
    docType: text("doc_type")
      .notNull()
      .$type<IncomingDocType>()
      .default("invoice"),
    number: text("number"),
    numberNormalized: text("number_normalized"),
    supplierNameRaw: text("supplier_name_raw"),
    supplierIcoRaw: text("supplier_ico_raw"),
    variableSymbol: text("variable_symbol"),
    constantSymbol: text("constant_symbol"),
    specificSymbol: text("specific_symbol"),
    issueDate: text("issue_date"),
    taxDate: text("tax_date"),
    dueDate: text("due_date"),
    receivedDate: text("received_date").notNull(),
    currency: text("currency").notNull().default("CZK"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }),
    vatTotal: numeric("vat_total", { precision: 14, scale: 2 }),
    total: numeric("total", { precision: 14, scale: 2 }),
    vatBreakdown: jsonb("vat_breakdown")
      .$type<IncomingVatBreakdownEntry[]>()
      .default([])
      .notNull(),
    paymentMethod: text("payment_method")
      .notNull()
      .$type<IncomingPaymentMethod>()
      .default("transfer"),
    beneficiaryIban: text("beneficiary_iban"),
    beneficiaryAccountNumber: text("beneficiary_account_number"),
    beneficiaryBankCode: text("beneficiary_bank_code"),
    beneficiaryBic: text("beneficiary_bic"),
    supplierBankAccountId: uuid("supplier_bank_account_id").references(
      () => supplierBankAccounts.id,
      { onDelete: "set null" },
    ),
    messageForRecipient: text("message_for_recipient"),
    paidAmount: numeric("paid_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    paymentState: text("payment_state")
      .notNull()
      .$type<IncomingPaymentState>()
      .default("unpaid"),
    extractionSource: text("extraction_source")
      .notNull()
      .$type<IncomingExtractionSource>(),
    extractionConfidence: jsonb("extraction_confidence")
      .$type<IncomingExtractionConfidence>()
      .default({})
      .notNull(),
    extractionModel: text("extraction_model"),
    extractedAt: timestamp("extracted_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectedByUserId: text("rejected_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectionReason: text("rejection_reason"),
    holdUntil: date("hold_until"),
    holdReason: text("hold_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    duplicateOfId: uuid("duplicate_of_id"),
    creditNoteOfId: uuid("credit_note_of_id"),
    activePaymentRunId: uuid("active_payment_run_id"),
    externalKey: text("external_key"),
    retainUntil: date("retain_until").notNull(),
    notes: text("notes"),
    exceptionCodes: jsonb("exception_codes")
      .$type<string[]>()
      .default([])
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("incoming_invoices_identity_uidx")
      .on(t.workspaceId, t.issuerId, t.supplierId, t.numberNormalized)
      .where(
        sql`${t.supplierId} is not null AND ${t.numberNormalized} is not null AND ${t.cancelledAt} is null AND ${t.status} <> 'rejected'`,
      ),
    index("incoming_invoices_workspace_status_idx").on(t.workspaceId, t.status),
    index("incoming_invoices_workspace_due_idx").on(t.workspaceId, t.dueDate),
    index("incoming_invoices_workspace_supplier_idx").on(
      t.workspaceId,
      t.supplierId,
    ),
    index("incoming_invoices_workspace_issuer_idx").on(
      t.workspaceId,
      t.issuerId,
    ),
    index("incoming_invoices_workspace_external_idx").on(
      t.workspaceId,
      t.externalKey,
    ),
  ],
);

export const incomingInvoiceLines = pgTable(
  "incoming_invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incomingInvoiceId: uuid("incoming_invoice_id")
      .notNull()
      .references(() => incomingInvoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unit: text("unit"),
    unitPriceWithoutVat: numeric("unit_price_without_vat", {
      precision: 14,
      scale: 4,
    }),
    vatRate: text("vat_rate"),
    lineSubtotal: numeric("line_subtotal", { precision: 14, scale: 2 }),
    lineVat: numeric("line_vat", { precision: 14, scale: 2 }),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }),
  },
  (t) => [index("incoming_invoice_lines_invoice_idx").on(t.incomingInvoiceId)],
);

export const incomingInvoiceDocuments = pgTable(
  "incoming_invoice_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incomingInvoiceId: uuid("incoming_invoice_id")
      .notNull()
      .references(() => incomingInvoices.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => incomingDocuments.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("incoming_invoice_documents_pair_uidx").on(
      t.incomingInvoiceId,
      t.documentId,
    ),
  ],
);

export const approvalRules = pgTable(
  "approval_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priority: integer("priority").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    conditionsVersion: integer("conditions_version").notNull().default(1),
    conditions: jsonb("conditions").$type<Record<string, unknown>>().notNull(),
    path: jsonb("path").$type<Record<string, unknown>>().notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("approval_rules_workspace_priority_uidx").on(
      t.workspaceId,
      t.priority,
    ),
  ],
);

export const approvalTasks = pgTable(
  "approval_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    incomingInvoiceId: uuid("incoming_invoice_id")
      .notNull()
      .references(() => incomingInvoices.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id").references(() => approvalRules.id, {
      onDelete: "set null",
    }),
    step: integer("step").notNull().default(1),
    assigneeUserId: text("assignee_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    assigneeRole: text("assignee_role"),
    status: text("status").notNull().default("pending"),
    decidedByUserId: text("decided_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("approval_tasks_workspace_status_idx").on(t.workspaceId, t.status),
    index("approval_tasks_assignee_status_idx").on(t.assigneeUserId, t.status),
    index("approval_tasks_invoice_idx").on(t.incomingInvoiceId),
  ],
);

export type PaymentRunStatus =
  | "draft"
  | "ready"
  | "submitting"
  | "submitted"
  | "failed"
  | "cancelled"
  | "closed";

export const paymentRuns = pgTable(
  "payment_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    issuerId: uuid("issuer_id")
      .notNull()
      .references(() => issuerBusinesses.id, { onDelete: "restrict" }),
    bankAccountId: uuid("bank_account_id").notNull(),
    name: text("name").notNull(),
    executionDate: text("execution_date").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull().$type<PaymentRunStatus>().default("draft"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    lineCount: integer("line_count").notNull().default(0),
    provider: text("provider").notNull().default("fio"),
    providerBatchId: text("provider_batch_id"),
    providerStatus: text("provider_status"),
    providerMessage: text("provider_message"),
    submitAttemptCount: integer("submit_attempt_count").notNull().default(0),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submittedByUserId: text("submitted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("payment_runs_workspace_status_idx").on(t.workspaceId, t.status),
    index("payment_runs_workspace_created_idx").on(t.workspaceId, t.createdAt),
  ],
);

export const paymentRunLines = pgTable(
  "payment_run_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    paymentRunId: uuid("payment_run_id")
      .notNull()
      .references(() => paymentRuns.id, { onDelete: "cascade" }),
    incomingInvoiceId: uuid("incoming_invoice_id")
      .notNull()
      .references(() => incomingInvoices.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    beneficiaryName: text("beneficiary_name"),
    beneficiaryIban: text("beneficiary_iban"),
    beneficiaryAccountNumber: text("beneficiary_account_number"),
    beneficiaryBankCode: text("beneficiary_bank_code"),
    beneficiaryBic: text("beneficiary_bic"),
    variableSymbol: text("variable_symbol"),
    constantSymbol: text("constant_symbol"),
    specificSymbol: text("specific_symbol"),
    messageForRecipient: text("message_for_recipient"),
    comment: text("comment"),
    rail: text("rail").notNull(),
    status: text("status").notNull().default("included"),
    dropReason: text("drop_reason"),
    sequence: integer("sequence"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("payment_run_lines_run_invoice_uidx").on(
      t.paymentRunId,
      t.incomingInvoiceId,
    ),
    index("payment_run_lines_invoice_idx").on(t.incomingInvoiceId),
  ],
);

export const payablePaymentAllocations = pgTable(
  "payable_payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    incomingInvoiceId: uuid("incoming_invoice_id")
      .notNull()
      .references(() => incomingInvoices.id, { onDelete: "cascade" }),
    bankTransactionId: uuid("bank_transaction_id").references(
      () => bankTransactions.id,
      { onDelete: "restrict" },
    ),
    proposalId: uuid("proposal_id"),
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
    index("payable_payment_allocations_invoice_idx").on(
      t.workspaceId,
      t.incomingInvoiceId,
    ),
    uniqueIndex("payable_payment_allocations_transaction_invoice_uidx")
      .on(t.bankTransactionId, t.incomingInvoiceId)
      .where(sql`${t.reversedAt} is null`),
  ],
);

export const payableMatchProposals = pgTable(
  "payable_match_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    bankTransactionId: uuid("bank_transaction_id")
      .notNull()
      .references(() => bankTransactions.id, { onDelete: "cascade" }),
    incomingInvoiceId: uuid("incoming_invoice_id")
      .notNull()
      .references(() => incomingInvoices.id, { onDelete: "cascade" }),
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
    uniqueIndex("payable_match_proposals_version_uidx").on(
      t.bankTransactionId,
      t.incomingInvoiceId,
      t.matcherVersion,
    ),
    index("payable_match_proposals_workspace_status_idx").on(
      t.workspaceId,
      t.status,
    ),
  ],
);
