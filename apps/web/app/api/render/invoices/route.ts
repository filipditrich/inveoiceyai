import { requireInvoiceRenderAuth } from "@/lib/auth/invoice-render";
import { invoiceRenderParseError } from "@/lib/invoice-render-http";
import { zipStore } from "@/lib/zip-store";
import { NextResponse } from "next/server";

import {
  parseInvoiceRenderRequest,
  renderInvoicePdfBatch,
} from "@invoicey/invoice-core";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BODY_BYTES = 2 * 1024 * 1024;

function contentDisposition(filename: string): string {
  return `attachment; filename="${filename}"`;
}

export async function POST(request: Request) {
  const gate = await requireInvoiceRenderAuth(request);
  if ("response" in gate) return gate.response;

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseInvoiceRenderRequest(body);
  if (!parsed.ok) {
    const mapped = invoiceRenderParseError(parsed);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }

  let files: Awaited<ReturnType<typeof renderInvoicePdfBatch>>;
  try {
    files = await renderInvoicePdfBatch(parsed.invoices);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("invalid_look")) {
      return NextResponse.json(
        {
          error: "invalid_look",
          detail: message.replace(/^invalid_look:\s*/u, "") || message,
        },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: "pdf_render_failed" }, { status: 500 });
  }

  const [single] = files;
  if (files.length === 1 && single) {
    return new NextResponse(Buffer.from(single.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(single.filename),
        "Cache-Control": "no-store",
      },
    });
  }

  const zip = zipStore(
    files.map((file) => ({ name: file.filename, data: file.bytes })),
  );
  return new NextResponse(Buffer.from(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition("invoices.zip"),
      "Cache-Control": "no-store",
    },
  });
}
