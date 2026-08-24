import { createHash } from "node:crypto";

import {
  ensureSupplier,
  incomingInvoices,
  persistIncomingInvoice,
  recordSupplierBankAccount,
  resolveIssuerByIco,
  upsertIncomingDocument,
  issuerBusinesses,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { parseIsdocAsIncoming } from "@invoicey/invoice-core";
import { desc, eq } from "drizzle-orm";

import { classifyDocument } from "./classify";

export async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch_failed_${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function processIncomingDocument(input: {
  workspaceId: string;
  inboxItemId?: string | null;
  issuerId?: string | null;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  subject?: string | null;
}): Promise<{
  documentId: string;
  invoiceId?: string;
  reused: boolean;
  classification: string;
}> {
  const bytes = await fetchBytes(input.fileUrl);
  const sha256 = sha256Hex(bytes);
  const classified = await classifyDocument({
    fileName: input.fileName,
    mimeType: input.mimeType,
    bytes,
    subject: input.subject,
  });

  const document = await upsertIncomingDocument(db, {
    workspaceId: input.workspaceId,
    inboxItemId: input.inboxItemId,
    fileUrl: input.fileUrl,
    fileName: input.fileName,
    mimeType: input.mimeType,
    byteSize: bytes.byteLength,
    sha256,
    kind: classified.kind,
    classification: classified.classification,
    classificationSource: classified.source,
  });

  const invoiceClass =
    classified.classification === "invoice" ||
    classified.classification === "credit_note";
  if (classified.isdocXml && invoiceClass) {
    return persistFromIsdoc({
      workspaceId: input.workspaceId,
      inboxItemId: input.inboxItemId,
      issuerId: input.issuerId,
      documentId: document.id,
      reused: document.reused,
      classification: classified.classification,
      kind: classified.kind,
      xml: classified.isdocXml,
    });
  }

  const maybeInvoice =
    classified.kind === "pdf" &&
    (invoiceClass || classified.classification === "unknown");
  if (maybeInvoice) {
    const { extractIncomingInvoiceWithAi } = await import("./extract-ai");
    const extracted = await extractIncomingInvoiceWithAi({
      workspaceId: input.workspaceId,
      pdfBytes: bytes,
      fileName: input.fileName,
    });
    if (!extracted.ok) {
      return persistExtractionFailure({
        workspaceId: input.workspaceId,
        inboxItemId: input.inboxItemId,
        issuerId: input.issuerId,
        documentId: document.id,
        reused: document.reused,
        classification: classified.classification,
      });
    }
    if (!extracted.data.number && !extracted.data.total) {
      return persistExtractionFailure({
        workspaceId: input.workspaceId,
        inboxItemId: input.inboxItemId,
        issuerId: input.issuerId,
        documentId: document.id,
        reused: document.reused,
        classification: classified.classification,
      });
    }
    return persistFromAi({
      workspaceId: input.workspaceId,
      inboxItemId: input.inboxItemId,
      issuerId: input.issuerId,
      documentId: document.id,
      reused: document.reused,
      extracted: extracted.data,
      model: extracted.model,
    });
  }

  return {
    documentId: document.id,
    reused: document.reused,
    classification: classified.classification,
  };
}

async function persistExtractionFailure(input: {
  workspaceId: string;
  inboxItemId?: string | null;
  issuerId?: string | null;
  documentId: string;
  reused: boolean;
  classification: string;
}) {
  const issuerId = await resolveFallbackIssuer(
    input.workspaceId,
    input.issuerId,
  );
  if (!issuerId) {
    return {
      documentId: input.documentId,
      reused: input.reused,
      classification: input.classification,
    };
  }
  const created = await persistIncomingInvoice(db, {
    workspaceId: input.workspaceId,
    issuerId,
    inboxItemId: input.inboxItemId,
    primaryDocumentId: input.documentId,
    receivedDate: new Date().toISOString().slice(0, 10),
    currency: "CZK",
    extractionSource: "manual",
    exceptionCodes: ["extraction_failed"],
    notes:
      "Automatic extraction was unavailable. Review the document fields manually.",
    documentIds: [{ documentId: input.documentId, role: "original" }],
  });
  await db
    .update(incomingInvoices)
    .set({ status: "extract_failed", updatedAt: new Date() })
    .where(eq(incomingInvoices.id, created.id));
  return {
    documentId: input.documentId,
    invoiceId: created.id,
    reused: input.reused,
    classification: input.classification,
  };
}

async function resolveFallbackIssuer(
  workspaceId: string,
  issuerId?: string | null,
): Promise<string | null> {
  if (issuerId) return issuerId;
  const [fallback] = await db
    .select({ id: issuerBusinesses.id })
    .from(issuerBusinesses)
    .where(eq(issuerBusinesses.workspaceId, workspaceId))
    .orderBy(desc(issuerBusinesses.isDefault), desc(issuerBusinesses.updatedAt))
    .limit(1);
  return fallback?.id ?? null;
}

async function persistFromIsdoc(input: {
  workspaceId: string;
  inboxItemId?: string | null;
  issuerId?: string | null;
  documentId: string;
  reused: boolean;
  classification: string;
  kind: string;
  xml: string;
}) {
  const parsed = parseIsdocAsIncoming(input.xml);
  let issuerId = input.issuerId ?? null;
  if (!issuerId) {
    const matches = await resolveIssuerByIco(
      db,
      input.workspaceId,
      parsed.customer.ico,
    );
    if (matches.length === 1) {
      issuerId = matches[0]!;
    }
  }
  let entityUnresolved = false;
  if (!issuerId) {
    const [fallback] = await db
      .select({ id: issuerBusinesses.id })
      .from(issuerBusinesses)
      .where(eq(issuerBusinesses.workspaceId, input.workspaceId))
      .orderBy(
        desc(issuerBusinesses.isDefault),
        desc(issuerBusinesses.updatedAt),
      )
      .limit(1);
    issuerId = fallback?.id ?? null;
    entityUnresolved = true;
  }
  if (!issuerId) {
    return {
      documentId: input.documentId,
      reused: input.reused,
      classification: input.classification,
    };
  }

  const supplier = await ensureSupplier(db, {
    workspaceId: input.workspaceId,
    name: parsed.supplier.name,
    ico: parsed.supplier.ico,
    dic: parsed.supplier.dic,
    address: parsed.supplier.address,
    country: parsed.supplier.address.country,
    source: "isdoc",
  });
  const account = await recordSupplierBankAccount(db, {
    workspaceId: input.workspaceId,
    supplierId: supplier.id,
    iban: parsed.payment.iban,
    accountNumber: parsed.payment.accountNumber,
    bankCode: parsed.payment.bankCode,
    bic: parsed.payment.bic,
    currency: parsed.header.currency,
    firstSeenDocumentId: input.documentId,
  });

  const created = await persistIncomingInvoice(db, {
    workspaceId: input.workspaceId,
    issuerId,
    supplierId: supplier.id,
    inboxItemId: input.inboxItemId,
    primaryDocumentId: input.documentId,
    docType: parsed.header.docType,
    number: parsed.header.number,
    supplierNameRaw: parsed.supplier.name,
    supplierIcoRaw: parsed.supplier.ico,
    variableSymbol: parsed.header.variableSymbol,
    constantSymbol: parsed.header.constantSymbol,
    specificSymbol: parsed.header.specificSymbol,
    issueDate: parsed.header.issueDate,
    taxDate: parsed.header.taxDate,
    dueDate: parsed.header.dueDate,
    receivedDate: new Date().toISOString().slice(0, 10),
    currency: parsed.header.currency,
    subtotal: parsed.header.subtotal,
    vatTotal: parsed.header.vatTotal,
    total: parsed.header.total,
    vatBreakdown: parsed.vatBreakdown,
    paymentMethod: parsed.header.paymentMethod,
    beneficiaryIban: parsed.payment.iban,
    beneficiaryAccountNumber: parsed.payment.accountNumber,
    beneficiaryBankCode: parsed.payment.bankCode,
    beneficiaryBic: parsed.payment.bic,
    supplierBankAccountId: account?.id,
    messageForRecipient: parsed.header.messageForRecipient,
    extractionSource: input.kind === "pdf" ? "isdoc_pdf" : "isdoc",
    exceptionCodes: entityUnresolved ? ["entity_unresolved"] : [],
    externalKey: parsed.isdocUuid,
    lines: parsed.lines,
    documentIds: [{ documentId: input.documentId, role: "original" }],
  });

  return {
    documentId: input.documentId,
    invoiceId: created.id,
    reused: input.reused,
    classification: input.classification,
  };
}

async function persistFromAi(input: {
  workspaceId: string;
  inboxItemId?: string | null;
  issuerId?: string | null;
  documentId: string;
  reused: boolean;
  extracted: import("./extract-ai").AiExtraction;
  model: string;
}) {
  const data = input.extracted;
  let issuerId = input.issuerId ?? null;
  if (!issuerId) {
    const [fallback] = await db
      .select({ id: issuerBusinesses.id })
      .from(issuerBusinesses)
      .where(eq(issuerBusinesses.workspaceId, input.workspaceId))
      .orderBy(
        desc(issuerBusinesses.isDefault),
        desc(issuerBusinesses.updatedAt),
      )
      .limit(1);
    issuerId = fallback?.id ?? null;
  }
  if (!issuerId) {
    return {
      documentId: input.documentId,
      reused: input.reused,
      classification: "invoice",
    };
  }
  const supplier = data.supplierName
    ? await ensureSupplier(db, {
        workspaceId: input.workspaceId,
        name: data.supplierName,
        ico: data.supplierIco,
        dic: data.supplierDic,
        source: "extract",
      })
    : null;
  const account = supplier
    ? await recordSupplierBankAccount(db, {
        workspaceId: input.workspaceId,
        supplierId: supplier.id,
        iban: data.iban,
        accountNumber: data.accountNumber,
        bankCode: data.bankCode,
        firstSeenDocumentId: input.documentId,
      })
    : null;
  const created = await persistIncomingInvoice(db, {
    workspaceId: input.workspaceId,
    issuerId,
    supplierId: supplier?.id,
    inboxItemId: input.inboxItemId,
    primaryDocumentId: input.documentId,
    number: data.number,
    supplierNameRaw: data.supplierName,
    supplierIcoRaw: data.supplierIco,
    variableSymbol: data.variableSymbol,
    issueDate: data.issueDate,
    taxDate: data.taxDate,
    dueDate: data.dueDate,
    receivedDate: new Date().toISOString().slice(0, 10),
    currency: data.currency ?? "CZK",
    subtotal: data.subtotal,
    vatTotal: data.vatTotal,
    total: data.total,
    beneficiaryIban: data.iban,
    beneficiaryAccountNumber: data.accountNumber,
    beneficiaryBankCode: data.bankCode,
    supplierBankAccountId: account?.id,
    extractionSource: "ai",
    extractionConfidence: data.confidence,
    extractionModel: input.model,
    documentIds: [{ documentId: input.documentId, role: "original" }],
  });
  return {
    documentId: input.documentId,
    invoiceId: created.id,
    reused: input.reused,
    classification: "invoice",
  };
}
