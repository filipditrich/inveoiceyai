import { createHash } from "node:crypto";
import {
  InvoiceSchema,
  isArchivePayload,
  renderInvoicePdf,
  renderIsdoc,
} from "@invoicey/invoice-core";
import type { invoices } from "@invoicey/db";
import { NextResponse } from "next/server";

type InvoiceRow = typeof invoices.$inferSelect;
const MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;

export type FileDisposition = "attachment" | "inline";

function contentDisposition(
  disposition: FileDisposition,
  filename: string,
): string {
  const unicodeName = filename
    .replace(/[\u0000-\u001f\u007f/\\]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 160);
  const asciiName =
    unicodeName
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]/gu, "")
      .replace(/["\\]/gu, "-") || "invoice";
  const encodedName = encodeURIComponent(unicodeName || "invoice").replace(
    /['()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

async function proxyStoredFile(
  url: string,
  filename: string,
  contentType: string,
  disposition: FileDisposition = "attachment",
  expectedSha256?: string | null,
): Promise<NextResponse> {
  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    throw new Error(`artifact fetch failed: ${upstream.status}`);
  }
  const declaredLength = Number(upstream.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ARTIFACT_BYTES) {
    throw new Error("artifact exceeds size limit");
  }

  const reader = upstream.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_ARTIFACT_BYTES) {
        await reader.cancel();
        throw new Error("artifact exceeds size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks, length);
  if (expectedSha256) {
    const actualSha256 = createHash("sha256").update(bytes).digest("hex");
    if (actualSha256 !== expectedSha256) {
      throw new Error("artifact integrity check failed");
    }
  }
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition(disposition, filename),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

function displayNumber(row: InvoiceRow): string {
  if (row.number) {
    return row.number;
  }
  if (isArchivePayload(row.payloadJson)) {
    return row.payloadJson.meta.number;
  }
  const parsed = InvoiceSchema.safeParse(row.payloadJson);
  if (parsed.success) {
    return parsed.data.meta.number;
  }
  return "invoice";
}

function isImmutableImport(row: InvoiceRow): boolean {
  return row.artifactsImmutable === 1 || Boolean(row.importCompleteness);
}

export function parseFileDisposition(
  raw: string | null | undefined,
): FileDisposition {
  return raw === "inline" ? "inline" : "attachment";
}

export async function serveInvoicePdf(
  row: InvoiceRow,
  disposition: FileDisposition = "attachment",
): Promise<NextResponse> {
  const filename = `${displayNumber(row)}-isdoc.pdf`;

  if (isImmutableImport(row)) {
    if (!row.pdfUrl) {
      return NextResponse.json(
        { error: "imported_pdf_missing" },
        { status: 404 },
      );
    }
    try {
      return await proxyStoredFile(
        row.pdfUrl,
        filename,
        "application/pdf",
        disposition,
        null,
      );
    } catch {
      return NextResponse.json(
        { error: "imported_pdf_unavailable" },
        { status: 502 },
      );
    }
  }

  const parsed = InvoiceSchema.safeParse(row.payloadJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 500 });
  }

  if (row.issuedAt) {
    if (!row.pdfUrl) {
      return NextResponse.json(
        { error: "issued_pdf_missing" },
        { status: 409 },
      );
    }
    try {
      return await proxyStoredFile(
        row.pdfUrl,
        filename,
        "application/pdf",
        disposition,
        row.pdfSha256,
      );
    } catch {
      return NextResponse.json(
        { error: "issued_pdf_unavailable" },
        { status: 502 },
      );
    }
  }

  const pdfBytes = await renderInvoicePdf(parsed.data);
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(disposition, filename),
      "Cache-Control": "no-store",
    },
  });
}

export async function serveInvoiceIsdoc(
  row: InvoiceRow,
  disposition: FileDisposition = "attachment",
): Promise<NextResponse> {
  const filename = `${displayNumber(row)}.isdoc`;

  if (isImmutableImport(row)) {
    if (!row.isdocUrl) {
      return NextResponse.json(
        { error: "imported_isdoc_missing" },
        { status: 404 },
      );
    }
    try {
      return await proxyStoredFile(
        row.isdocUrl,
        filename,
        "application/xml; charset=utf-8",
        disposition,
        null,
      );
    } catch {
      return NextResponse.json(
        { error: "imported_isdoc_unavailable" },
        { status: 502 },
      );
    }
  }

  const parsed = InvoiceSchema.safeParse(row.payloadJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 500 });
  }

  if (row.issuedAt) {
    if (!row.isdocUrl) {
      return NextResponse.json(
        { error: "issued_isdoc_missing" },
        { status: 409 },
      );
    }
    try {
      return await proxyStoredFile(
        row.isdocUrl,
        filename,
        "application/xml; charset=utf-8",
        disposition,
        row.isdocSha256,
      );
    } catch {
      return NextResponse.json(
        { error: "issued_isdoc_unavailable" },
        { status: 502 },
      );
    }
  }

  const xml = renderIsdoc(parsed.data);
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": contentDisposition(disposition, filename),
      "Cache-Control": "no-store",
    },
  });
}
