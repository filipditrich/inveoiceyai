import { and, eq, sql } from "drizzle-orm";
import {
  computeRetainUntil,
  normalizeInvoiceNumber,
  validateIncomingInvoice,
  type IncomingException,
} from "@invoicey/invoice-core/incoming";

import type { InvoiceyDb } from "./create-db";
import {
  incomingDocuments,
  incomingInvoiceDocuments,
  incomingInvoiceLines,
  incomingInvoices,
  inboxItems,
  paymentAuditEvents,
  supplierBankAccounts,
  suppliers,
  type IncomingDocType,
  type IncomingExtractionSource,
  type IncomingPaymentMethod,
  type IncomingVatBreakdownEntry,
  type SupplierAddress,
} from "./schema";
import { issuerBusinesses } from "./schema";
import { withDbTransaction, type DbTransaction } from "./transaction";

type DbOrTx = InvoiceyDb | DbTransaction;

export function normalizeSupplierName(name: string): string {
  return name.normalize("NFKC").trim().replaceAll(/\s+/g, " ");
}

async function addAuditEvent(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    action: string;
    actorType: "user" | "system";
    actorUserId?: string;
    entityType: string;
    entityId: string;
    payload?: Record<string, unknown>;
  },
) {
  await tx.insert(paymentAuditEvents).values({
    workspaceId: input.workspaceId,
    action: input.action,
    actorType: input.actorType,
    actorUserId: input.actorUserId,
    entityType: input.entityType,
    entityId: input.entityId,
    payloadJson: input.payload ?? {},
  });
}

export async function resolveIssuerByIco(
  database: DbOrTx,
  workspaceId: string,
  ico: string | null | undefined,
): Promise<string[]> {
  if (!ico) {
    return [];
  }
  const digits = ico.replaceAll(/\D/g, "");
  if (!digits) {
    return [];
  }
  const rows = await database
    .select({ id: issuerBusinesses.id })
    .from(issuerBusinesses)
    .where(
      and(
        eq(issuerBusinesses.workspaceId, workspaceId),
        sql`regexp_replace(coalesce(${issuerBusinesses.snapshot}->>'ico', ''), '\\D', '', 'g') = ${digits}`,
      ),
    );
  return rows.map((row) => row.id);
}

export async function ensureSupplier(
  database: DbOrTx,
  input: {
    workspaceId: string;
    name: string;
    ico?: string | null;
    dic?: string | null;
    vatId?: string | null;
    address?: SupplierAddress;
    country?: string;
    source: string;
    clientId?: string | null;
  },
): Promise<{ id: string; created: boolean }> {
  const ico = input.ico?.replaceAll(/\D/g, "") || null;
  const name = normalizeSupplierName(input.name);
  const country = input.country ?? "CZ";

  if (ico) {
    const [existing] = await database
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.workspaceId, input.workspaceId),
          eq(suppliers.ico, ico),
        ),
      )
      .limit(1);
    if (existing) {
      return { id: existing.id, created: false };
    }
  } else {
    const [existing] = await database
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.workspaceId, input.workspaceId),
          sql`lower(regexp_replace(btrim(${suppliers.name}), '\\s+', ' ', 'g')) = ${name.toLowerCase()}`,
          eq(suppliers.country, country),
          sql`coalesce(${suppliers.ico}, '') = ''`,
        ),
      )
      .limit(1);
    if (existing) {
      return { id: existing.id, created: false };
    }
  }

  try {
    const [created] = await database
      .insert(suppliers)
      .values({
        workspaceId: input.workspaceId,
        name,
        ico,
        dic: input.dic ?? null,
        vatId: input.vatId ?? null,
        address: input.address ?? {},
        country,
        source: input.source,
        clientId: input.clientId ?? null,
      })
      .returning();
    if (!created) {
      throw new Error("supplier_insert_failed");
    }
    return { id: created.id, created: true };
  } catch {
    if (ico) {
      const [existing] = await database
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(
          and(
            eq(suppliers.workspaceId, input.workspaceId),
            eq(suppliers.ico, ico),
          ),
        )
        .limit(1);
      if (existing) return { id: existing.id, created: false };
    }
    throw new Error("supplier_upsert_failed");
  }
}

export async function recordSupplierBankAccount(
  database: DbOrTx,
  input: {
    workspaceId: string;
    supplierId: string;
    iban?: string | null;
    accountNumber?: string | null;
    bankCode?: string | null;
    bic?: string | null;
    currency?: string | null;
    firstSeenDocumentId?: string | null;
  },
): Promise<{ id: string; confirmed: boolean } | null> {
  const iban = input.iban?.replaceAll(/\s+/g, "").toUpperCase() || null;
  const accountNumber = input.accountNumber?.trim() || null;
  const bankCode = input.bankCode?.trim() || null;
  if (!iban && !(accountNumber && bankCode)) {
    return null;
  }

  const identity = iban ?? `${accountNumber}/${bankCode}`;
  const [existing] = await database
    .select({
      id: supplierBankAccounts.id,
      confirmedAt: supplierBankAccounts.confirmedAt,
    })
    .from(supplierBankAccounts)
    .where(
      and(
        eq(supplierBankAccounts.supplierId, input.supplierId),
        sql`coalesce(${supplierBankAccounts.iban}, ${supplierBankAccounts.accountNumber} || '/' || ${supplierBankAccounts.bankCode}) = ${identity}`,
      ),
    )
    .limit(1);
  if (existing) {
    return { id: existing.id, confirmed: Boolean(existing.confirmedAt) };
  }

  const [created] = await database
    .insert(supplierBankAccounts)
    .values({
      workspaceId: input.workspaceId,
      supplierId: input.supplierId,
      iban,
      accountNumber,
      bankCode,
      bic: input.bic ?? null,
      currency: input.currency ?? null,
      firstSeenDocumentId: input.firstSeenDocumentId ?? null,
    })
    .returning();
  if (!created) {
    throw new Error("supplier_bank_account_insert_failed");
  }
  return { id: created.id, confirmed: false };
}

export type PersistIncomingInvoiceInput = {
  workspaceId: string;
  issuerId: string;
  supplierId?: string | null;
  inboxItemId?: string | null;
  primaryDocumentId?: string | null;
  docType?: IncomingDocType;
  number?: string | null;
  supplierNameRaw?: string | null;
  supplierIcoRaw?: string | null;
  variableSymbol?: string | null;
  constantSymbol?: string | null;
  specificSymbol?: string | null;
  issueDate?: string | null;
  taxDate?: string | null;
  dueDate?: string | null;
  receivedDate: string;
  currency: string;
  subtotal?: string | null;
  vatTotal?: string | null;
  total?: string | null;
  vatBreakdown?: IncomingVatBreakdownEntry[];
  paymentMethod?: IncomingPaymentMethod;
  beneficiaryIban?: string | null;
  beneficiaryAccountNumber?: string | null;
  beneficiaryBankCode?: string | null;
  beneficiaryBic?: string | null;
  supplierBankAccountId?: string | null;
  messageForRecipient?: string | null;
  extractionSource: IncomingExtractionSource;
  extractionConfidence?: Record<string, "high" | "medium" | "low">;
  extractionModel?: string | null;
  externalKey?: string | null;
  notes?: string | null;
  exceptionCodes?: string[];
  lines?: Array<{
    position: number;
    description: string;
    quantity: string;
    unit?: string | null;
    unitPriceWithoutVat?: string | null;
    vatRate?: string | null;
    lineSubtotal?: string | null;
    lineVat?: string | null;
    lineTotal?: string | null;
  }>;
  documentIds?: Array<{ documentId: string; role: string }>;
};

export async function persistIncomingInvoice(
  database: DbOrTx,
  input: PersistIncomingInvoiceInput,
): Promise<{ id: string; exceptions: IncomingException[] }> {
  const numberNormalized = normalizeInvoiceNumber(input.number);
  let duplicateOfId: string | null = null;
  if (input.supplierId && numberNormalized) {
    const [dup] = await database
      .select({ id: incomingInvoices.id })
      .from(incomingInvoices)
      .where(
        and(
          eq(incomingInvoices.workspaceId, input.workspaceId),
          eq(incomingInvoices.issuerId, input.issuerId),
          eq(incomingInvoices.supplierId, input.supplierId),
          eq(incomingInvoices.numberNormalized, numberNormalized),
          sql`${incomingInvoices.cancelledAt} is null`,
          sql`${incomingInvoices.status} <> 'rejected'`,
        ),
      )
      .limit(1);
    if (dup) {
      duplicateOfId = dup.id;
    }
  }

  const exceptions = validateIncomingInvoice({
    supplierId: input.supplierId,
    supplierIco: input.supplierIcoRaw,
    supplierName: input.supplierNameRaw,
    number: input.number,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    currency: input.currency,
    total: input.total,
    subtotal: input.subtotal,
    vatTotal: input.vatTotal,
    vatBreakdown: input.vatBreakdown,
    lines: input.lines,
    paymentMethod: input.paymentMethod,
    beneficiaryIban: input.beneficiaryIban,
    beneficiaryAccountNumber: input.beneficiaryAccountNumber,
    beneficiaryBankCode: input.beneficiaryBankCode,
    beneficiaryConfirmed: input.supplierBankAccountId
      ? undefined
      : input.beneficiaryIban || input.beneficiaryAccountNumber
        ? false
        : undefined,
    issuerResolved: true,
    duplicateOfId,
    extractionSource: input.extractionSource,
    extractionConfidence: input.extractionConfidence,
  });

  const [row] = await database
    .insert(incomingInvoices)
    .values({
      workspaceId: input.workspaceId,
      issuerId: input.issuerId,
      supplierId: input.supplierId ?? null,
      inboxItemId: input.inboxItemId ?? null,
      primaryDocumentId: input.primaryDocumentId ?? null,
      status: "needs_review",
      docType: input.docType ?? "invoice",
      number: input.number ?? null,
      numberNormalized,
      supplierNameRaw: input.supplierNameRaw ?? null,
      supplierIcoRaw: input.supplierIcoRaw ?? null,
      variableSymbol: input.variableSymbol ?? null,
      constantSymbol: input.constantSymbol ?? null,
      specificSymbol: input.specificSymbol ?? null,
      issueDate: input.issueDate ?? null,
      taxDate: input.taxDate ?? null,
      dueDate: input.dueDate ?? null,
      receivedDate: input.receivedDate,
      currency: input.currency,
      subtotal: input.subtotal ?? null,
      vatTotal: input.vatTotal ?? null,
      total: input.total ?? null,
      vatBreakdown: input.vatBreakdown ?? [],
      paymentMethod: input.paymentMethod ?? "transfer",
      beneficiaryIban: input.beneficiaryIban ?? null,
      beneficiaryAccountNumber: input.beneficiaryAccountNumber ?? null,
      beneficiaryBankCode: input.beneficiaryBankCode ?? null,
      beneficiaryBic: input.beneficiaryBic ?? null,
      supplierBankAccountId: input.supplierBankAccountId ?? null,
      messageForRecipient: input.messageForRecipient ?? null,
      extractionSource: input.extractionSource,
      extractionConfidence: input.extractionConfidence ?? {},
      extractionModel: input.extractionModel ?? null,
      extractedAt: new Date(),
      duplicateOfId,
      externalKey: input.externalKey ?? null,
      retainUntil: computeRetainUntil(input.taxDate, input.issueDate),
      notes: input.notes ?? null,
      exceptionCodes: [
        ...new Set([
          ...(input.exceptionCodes ?? []),
          ...exceptions.map((item) => item.code),
        ]),
      ],
    })
    .returning();
  if (!row) {
    throw new Error("incoming_invoice_insert_failed");
  }

  if (input.lines?.length) {
    await database.insert(incomingInvoiceLines).values(
      input.lines.map((line) => ({
        incomingInvoiceId: row.id,
        position: line.position,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit ?? null,
        unitPriceWithoutVat: line.unitPriceWithoutVat ?? null,
        vatRate: line.vatRate ?? null,
        lineSubtotal: line.lineSubtotal ?? null,
        lineVat: line.lineVat ?? null,
        lineTotal: line.lineTotal ?? null,
      })),
    );
  }

  if (input.documentIds?.length) {
    await database.insert(incomingInvoiceDocuments).values(
      input.documentIds.map((doc) => ({
        incomingInvoiceId: row.id,
        documentId: doc.documentId,
        role: doc.role,
      })),
    );
  }

  return { id: row.id, exceptions };
}

export async function acceptIncomingInvoice(input: {
  workspaceId: string;
  invoiceId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string; field?: string }> {
  return withDbTransaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(incomingInvoices)
      .where(
        and(
          eq(incomingInvoices.id, input.invoiceId),
          eq(incomingInvoices.workspaceId, input.workspaceId),
        ),
      )
      .for("update")
      .limit(1);
    if (!invoice) {
      return { ok: false, error: "not_found" };
    }
    if (invoice.status !== "needs_review" && invoice.status !== "on_hold") {
      return { ok: false, error: "not_reviewable" };
    }

    const exceptions = validateIncomingInvoice({
      supplierId: invoice.supplierId,
      supplierIco: invoice.supplierIcoRaw,
      supplierName: invoice.supplierNameRaw,
      number: invoice.number,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      total: invoice.total,
      subtotal: invoice.subtotal,
      vatTotal: invoice.vatTotal,
      vatBreakdown: invoice.vatBreakdown,
      paymentMethod: invoice.paymentMethod,
      beneficiaryIban: invoice.beneficiaryIban,
      beneficiaryAccountNumber: invoice.beneficiaryAccountNumber,
      beneficiaryBankCode: invoice.beneficiaryBankCode,
      issuerResolved: true,
      duplicateOfId: invoice.duplicateOfId,
    });
    const blocking = exceptions.find(
      (item) =>
        item.code === "missing_required_field" ||
        item.code === "duplicate_invoice" ||
        item.code === "entity_unresolved",
    );
    if (blocking) {
      return { ok: false, error: blocking.code, field: blocking.field };
    }

    await tx
      .update(incomingInvoices)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByUserId: input.actorUserId,
        retainUntil: invoice.retainUntil,
        exceptionCodes: exceptions.map((item) => item.code),
        updatedAt: new Date(),
      })
      .where(eq(incomingInvoices.id, invoice.id));

    if (invoice.primaryDocumentId) {
      await tx
        .update(incomingDocuments)
        .set({ retainUntil: invoice.retainUntil })
        .where(eq(incomingDocuments.id, invoice.primaryDocumentId));
    }

    await addAuditEvent(tx, {
      workspaceId: input.workspaceId,
      action: "incoming_invoice.accepted",
      actorType: "user",
      actorUserId: input.actorUserId,
      entityType: "incoming_invoice",
      entityId: invoice.id,
    });
    return { ok: true };
  });
}

export async function rejectIncomingInvoice(input: {
  workspaceId: string;
  invoiceId: string;
  actorUserId: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return withDbTransaction(async (tx) => {
    const [invoice] = await tx
      .select({ id: incomingInvoices.id, status: incomingInvoices.status })
      .from(incomingInvoices)
      .where(
        and(
          eq(incomingInvoices.id, input.invoiceId),
          eq(incomingInvoices.workspaceId, input.workspaceId),
        ),
      )
      .for("update")
      .limit(1);
    if (!invoice) return { ok: false, error: "not_found" };
    await tx
      .update(incomingInvoices)
      .set({
        status: "rejected",
        rejectedAt: new Date(),
        rejectedByUserId: input.actorUserId,
        rejectionReason: input.reason,
        updatedAt: new Date(),
      })
      .where(eq(incomingInvoices.id, invoice.id));
    await addAuditEvent(tx, {
      workspaceId: input.workspaceId,
      action: "incoming_invoice.rejected",
      actorType: "user",
      actorUserId: input.actorUserId,
      entityType: "incoming_invoice",
      entityId: invoice.id,
      payload: { reason: input.reason },
    });
    return { ok: true };
  });
}

export async function deleteIncomingInvoice(input: {
  workspaceId: string;
  invoiceId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return withDbTransaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(incomingInvoices)
      .where(
        and(
          eq(incomingInvoices.id, input.invoiceId),
          eq(incomingInvoices.workspaceId, input.workspaceId),
        ),
      )
      .for("update")
      .limit(1);
    if (!invoice) return { ok: false, error: "not_found" };
    const today = new Date().toISOString().slice(0, 10);
    if (invoice.acceptedAt && invoice.retainUntil >= today) {
      return { ok: false, error: "retention_window" };
    }
    if (
      invoice.status === "accepted" ||
      invoice.status === "approved" ||
      invoice.status === "pending_approval"
    ) {
      await tx
        .update(incomingInvoices)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(incomingInvoices.id, invoice.id));
      await addAuditEvent(tx, {
        workspaceId: input.workspaceId,
        action: "incoming_invoice.cancelled",
        actorType: "user",
        actorUserId: input.actorUserId,
        entityType: "incoming_invoice",
        entityId: invoice.id,
      });
      return { ok: true };
    }
    await tx
      .delete(incomingInvoices)
      .where(eq(incomingInvoices.id, invoice.id));
    return { ok: true };
  });
}

export async function upsertIncomingDocument(
  database: DbOrTx,
  input: {
    workspaceId: string;
    inboxItemId?: string | null;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
    sha256: string;
    kind: "pdf" | "isdoc" | "isdocx" | "image" | "other";
    classification?: string | null;
    classificationSource?: string | null;
  },
): Promise<{ id: string; reused: boolean }> {
  const [existing] = await database
    .select({ id: incomingDocuments.id })
    .from(incomingDocuments)
    .where(
      and(
        eq(incomingDocuments.workspaceId, input.workspaceId),
        eq(incomingDocuments.sha256, input.sha256),
      ),
    )
    .limit(1);
  if (existing) {
    return { id: existing.id, reused: true };
  }
  const [created] = await database
    .insert(incomingDocuments)
    .values({
      workspaceId: input.workspaceId,
      inboxItemId: input.inboxItemId ?? null,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      sha256: input.sha256,
      kind: input.kind,
      classification: input.classification as never,
      classificationSource: input.classificationSource ?? null,
    })
    .returning();
  if (!created) {
    throw new Error("incoming_document_insert_failed");
  }
  return { id: created.id, reused: false };
}

export async function createUploadInboxItem(
  database: DbOrTx,
  input: {
    workspaceId: string;
    userId: string;
    issuerId?: string | null;
  },
): Promise<string> {
  const [row] = await database
    .insert(inboxItems)
    .values({
      workspaceId: input.workspaceId,
      source: "upload",
      issuerId: input.issuerId ?? null,
      createdByUserId: input.userId,
      status: "processing",
      receivedAt: new Date(),
    })
    .returning();
  if (!row) {
    throw new Error("inbox_item_insert_failed");
  }
  return row.id;
}
