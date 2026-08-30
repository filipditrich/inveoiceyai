"use server";

import { requireWorkspace } from "@/lib/auth/session";
import { assertCan } from "@/lib/authz/can";
import {
  detectInvoiceOrigin,
  extractIsdocFromPdf,
  InvoiceOriginProviderSchema,
  IssuerSnapshotSchema,
  parseIsdoc,
  readPdfOriginHints,
  type ArchiveInvoicePayload,
  type Invoice,
  type InvoiceOrigin,
  type InvoiceOriginProvider,
} from "@invoicey/invoice-core";
import { issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  buildExternalKey,
  createImportBatch,
  finalizeImportBatch,
  insertIssuedImport,
  syncNumberingCounterAfterImport,
} from "@invoicey/invoice-tools/import";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { UTApi, UTFile } from "uploadthing/server";

export type ClassifiedImportFile = {
  fileName: string;
  pdfUrl: string;
  status: "ready_full" | "needs_archive_fields" | "error";
  error?: string;
  detectedOrigin: InvoiceOrigin;
  isdocXml?: string;
  invoice?: Invoice;
  archive?: ArchiveInvoicePayload;
  externalKey?: string;
  paid: boolean;
};

export type CommitImportItem = {
  fileName: string;
  pdfUrl: string;
  isdocXml?: string;
  completeness: "full" | "archive";
  invoice?: Invoice;
  archive?: ArchiveInvoicePayload;
  externalKey: string;
  origin: InvoiceOrigin;
  paid: boolean;
  paidAt?: string | null;
};

async function loadIssuer(workspaceId: string, issuerId: string) {
  const rows = await db
    .select()
    .from(issuerBusinesses)
    .where(
      and(
        eq(issuerBusinesses.id, issuerId),
        eq(issuerBusinesses.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const snap = rows[0]
    ? IssuerSnapshotSchema.safeParse(rows[0].snapshot)
    : null;
  if (!snap?.success) {
    return null;
  }
  return snap.data;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch_failed_${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function uploadIsdocXml(
  number: string,
  xml: string,
): Promise<string | null> {
  if (!process.env.UPLOADTHING_TOKEN?.trim()) {
    return null;
  }
  const utapi = new UTApi();
  const file = new UTFile([Buffer.from(xml, "utf8")], `${number}.isdoc`, {
    type: "application/xml",
  });
  const result = await utapi.uploadFiles(file);
  if (result.error || !result.data) {
    return null;
  }
  return result.data.ufsUrl ?? result.data.url;
}

/** Classify uploaded PDFs: extract ISDOC when present, else archive stubs. */
export async function classifyImportPdfs(input: {
  issuerId: string;
  files: Array<{ fileName: string; pdfUrl: string; isdocUrl?: string }>;
  defaultPaid?: boolean;
}): Promise<{ rows: ClassifiedImportFile[]; error?: string }> {
  const { workspaceId } = await requireWorkspace();
  await assertCan("import:run");
  const issuer = await loadIssuer(workspaceId, input.issuerId);
  if (!issuer) {
    return { rows: [], error: "issuer_not_found" };
  }

  const rows: ClassifiedImportFile[] = [];
  for (const file of input.files) {
    try {
      const pdfBytes = await fetchBytes(file.pdfUrl);
      const hints = await readPdfOriginHints(pdfBytes);
      let xml =
        (await extractIsdocFromPdf(pdfBytes)) ??
        (file.isdocUrl
          ? new TextDecoder().decode(await fetchBytes(file.isdocUrl))
          : null);

      if (xml) {
        const parsed = parseIsdoc(xml, { issuer });
        const origin = detectInvoiceOrigin({
          softwareName: parsed.softwareName,
          producer: hints.producer,
          creator: hints.creator,
          keywords: hints.keywords,
        });
        rows.push({
          fileName: file.fileName,
          pdfUrl: file.pdfUrl,
          status: "ready_full",
          detectedOrigin: origin,
          isdocXml: xml,
          invoice: parsed.invoice,
          externalKey: buildExternalKey({
            isdocUuid: parsed.isdocUuid,
            provider: origin.provider,
            number: parsed.invoice.meta.number,
            issueDate: parsed.invoice.meta.issueDate,
          }),
          paid: Boolean(input.defaultPaid),
        });
        continue;
      }

      const origin = detectInvoiceOrigin({
        producer: hints.producer,
        creator: hints.creator,
        keywords: hints.keywords,
      });
      const stub: ArchiveInvoicePayload = {
        kind: "archive",
        meta: {
          docType: "invoice",
          number: "",
          issueDate: "",
          dueDate: "",
          language: "cs",
          currency: "CZK",
        },
        client: { name: "" },
        totals: { subtotal: 0, vatTotal: 0, total: 0 },
        origin,
      };
      rows.push({
        fileName: file.fileName,
        pdfUrl: file.pdfUrl,
        status: "needs_archive_fields",
        detectedOrigin: origin,
        archive: stub,
        paid: Boolean(input.defaultPaid),
      });
    } catch (err) {
      rows.push({
        fileName: file.fileName,
        pdfUrl: file.pdfUrl,
        status: "error",
        error: err instanceof Error ? err.message : "classify_failed",
        detectedOrigin: { provider: "custom" },
        paid: Boolean(input.defaultPaid),
      });
    }
  }

  return { rows };
}

/** Commit classified import rows as issued invoices with immutable artifacts. */
export async function commitInvoiceImport(input: {
  issuerId: string;
  originProvider: InvoiceOriginProvider;
  originLabel?: string;
  originVersion?: string;
  defaultPaid: boolean;
  items: CommitImportItem[];
}): Promise<{
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ fileName: string; error: string }>;
}> {
  const { workspaceId } = await requireWorkspace();
  await assertCan("import:run");
  const issuer = await loadIssuer(workspaceId, input.issuerId);
  if (!issuer) {
    return {
      created: 0,
      skipped: 0,
      failed: input.items.length,
      errors: [{ fileName: "*", error: "issuer_not_found" }],
    };
  }

  const providerParse = InvoiceOriginProviderSchema.safeParse(
    input.originProvider,
  );
  const batchOrigin: InvoiceOrigin = {
    provider: providerParse.success ? providerParse.data : "custom",
    label: input.originLabel,
    version: input.originVersion,
  };

  const batchId = await createImportBatch(db, {
    workspaceId,
    issuerId: input.issuerId,
    origin: batchOrigin,
    defaultPaid: input.defaultPaid,
  });

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ fileName: string; error: string }> = [];
  const docTypes = new Set<string>();
  const chunkSize = 25;
  for (let i = 0; i < input.items.length; i += chunkSize) {
    const chunk = input.items.slice(i, i + chunkSize);
    for (const item of chunk) {
      try {
        const origin: InvoiceOrigin = {
          provider: item.origin.provider || batchOrigin.provider,
          label: item.origin.label ?? batchOrigin.label,
          version: item.origin.version ?? batchOrigin.version,
        };
        const paidAt =
          item.paid || input.defaultPaid
            ? item.paidAt
              ? new Date(`${item.paidAt}T12:00:00.000Z`)
              : new Date()
            : null;

        let isdocUrl: string | null = null;
        if (item.isdocXml && item.completeness === "full" && item.invoice) {
          isdocUrl = await uploadIsdocXml(
            item.invoice.meta.number,
            item.isdocXml,
          );
        }

        let result: Awaited<ReturnType<typeof insertIssuedImport>>;
        if (item.completeness === "full" && item.invoice) {
          result = await insertIssuedImport(db, {
            workspaceId,
            issuerId: input.issuerId,
            issuerSnapshot: issuer,
            origin,
            completeness: "full",
            invoice: item.invoice,
            importBatchId: batchId,
            externalKey: item.externalKey,
            pdfUrl: item.pdfUrl,
            isdocUrl,
            paidAt,
          });
          docTypes.add(item.invoice.meta.docType);
        } else if (item.completeness === "archive" && item.archive) {
          result = await insertIssuedImport(db, {
            workspaceId,
            issuerId: input.issuerId,
            issuerSnapshot: issuer,
            origin,
            completeness: "archive",
            archive: item.archive,
            importBatchId: batchId,
            externalKey: item.externalKey,
            pdfUrl: item.pdfUrl,
            isdocUrl: null,
            paidAt,
          });
          docTypes.add(item.archive.meta.docType);
        } else {
          failed += 1;
          errors.push({ fileName: item.fileName, error: "incomplete_item" });
          continue;
        }

        if (!result.ok) {
          failed += 1;
          errors.push({ fileName: item.fileName, error: result.error });
          continue;
        }
        if (!result.created) {
          skipped += 1;
          continue;
        }
        created += 1;
      } catch (err) {
        failed += 1;
        errors.push({
          fileName: item.fileName,
          error: err instanceof Error ? err.message : "commit_failed",
        });
      }
    }
  }

  for (const docType of docTypes) {
    await syncNumberingCounterAfterImport(db, {
      workspaceId,
      issuerId: input.issuerId,
      docType,
    });
  }

  await finalizeImportBatch(db, batchId, { created, skipped, failed });
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { created, skipped, failed, errors };
}
