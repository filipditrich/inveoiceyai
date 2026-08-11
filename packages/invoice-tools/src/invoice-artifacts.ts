import { invoices, tryCreateDbFromEnv } from "@invoicey/db";
import {
  InvoiceSchema,
  renderInvoicePdf,
  renderIsdoc,
  type Invoice,
} from "@invoicey/invoice-core";
import { and, eq } from "drizzle-orm";
import { UTApi, UTFile } from "uploadthing/server";

import { resolveWorkspaceId } from "./workspace-context";

export type InvoiceArtifactUrls = {
  pdfUrl: string;
  isdocUrl: string;
  pdfGeneratedAt: Date;
};

function hasUploadToken(): boolean {
  return Boolean(process.env.UPLOADTHING_TOKEN?.trim());
}

async function uploadBytes(
  bytes: Uint8Array | string,
  name: string,
  type: string,
): Promise<string> {
  const utapi = new UTApi();
  const body =
    typeof bytes === "string" ? Buffer.from(bytes, "utf8") : Buffer.from(bytes);
  const file = new UTFile([body], name, { type });
  const result = await utapi.uploadFiles(file);
  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? `upload failed for ${name}`);
  }
  return result.data.ufsUrl ?? result.data.url;
}

/**
 * Ensure issued invoice has persisted PDF + ISDOC URLs.
 * No-op for drafts. Uploads via UploadThing when `UPLOADTHING_TOKEN` is set.
 */
export async function ensureInvoiceArtifacts(options: {
  id: string;
  workspaceId?: string;
  /** Skip DB load when caller already has the issued payload. */
  invoice?: Invoice;
}): Promise<InvoiceArtifactUrls | null> {
  const database = tryCreateDbFromEnv();
  if (!database) {
    return null;
  }
  const workspaceId = resolveWorkspaceId(options.workspaceId);
  const rows = await database
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.id, options.id), eq(invoices.workspaceId, workspaceId)),
    )
    .limit(1);
  const row = rows[0];
  if (!row || !row.issuedAt) {
    return null;
  }

  if (row.pdfUrl && row.isdocUrl) {
    return {
      pdfUrl: row.pdfUrl,
      isdocUrl: row.isdocUrl,
      pdfGeneratedAt: row.pdfGeneratedAt ?? row.issuedAt,
    };
  }

  if (row.artifactsImmutable === 1 || row.importCompleteness) {
    if (row.pdfUrl) {
      return {
        pdfUrl: row.pdfUrl,
        isdocUrl: row.isdocUrl ?? row.pdfUrl,
        pdfGeneratedAt: row.pdfGeneratedAt ?? row.issuedAt,
      };
    }
    return null;
  }

  if (!hasUploadToken()) {
    return null;
  }

  const parsed = options.invoice
    ? { success: true as const, data: options.invoice }
    : InvoiceSchema.safeParse(row.payloadJson);
  if (!parsed.success) {
    throw new Error("invalid_payload");
  }

  const number = parsed.data.meta.number || row.number || options.id;
  let pdfUrl = row.pdfUrl;
  let isdocUrl = row.isdocUrl;

  if (!pdfUrl) {
    const pdfBytes = await renderInvoicePdf(parsed.data);
    pdfUrl = await uploadBytes(
      pdfBytes,
      `${number}-isdoc.pdf`,
      "application/pdf",
    );
  }
  if (!isdocUrl) {
    const xml = renderIsdoc(parsed.data);
    isdocUrl = await uploadBytes(xml, `${number}.isdoc`, "application/xml");
  }

  const pdfGeneratedAt = new Date();
  await database
    .update(invoices)
    .set({
      pdfUrl,
      isdocUrl,
      pdfGeneratedAt,
      updatedAt: pdfGeneratedAt,
    })
    .where(eq(invoices.id, options.id));

  return { pdfUrl, isdocUrl, pdfGeneratedAt };
}

/** Best-effort persist after issue — never throws to the issue caller. */
export async function tryPersistInvoiceArtifacts(options: {
  id: string;
  workspaceId?: string;
  invoice?: Invoice;
}): Promise<void> {
  try {
    await ensureInvoiceArtifacts(options);
  } catch (err) {
    console.error("[invoice-artifacts] persist failed", options.id, err);
  }
}
