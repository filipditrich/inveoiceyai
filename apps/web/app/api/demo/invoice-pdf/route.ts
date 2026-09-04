import { getOptionalSession } from "@/lib/auth/session";
import {
  clientIpKey,
  createConcurrencyGate,
  createFixedWindowLimiter,
} from "@/lib/rate-limit";
import { checkBotId } from "botid/server";
import { type NextRequest, NextResponse } from "next/server";

import {
  InvoiceSchema,
  invoiceLabels,
  renderInvoicePdf,
} from "@invoicey/invoice-core";
import { issuedByFromProfile, withIssuedBy } from "@invoicey/invoice-tools";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 128 * 1024;
const MAX_ITEMS = 100;
const LOCKED_PREVIEW_HEADER = "x-invoicey-locked-preview";
const previewLimiter = createFixedWindowLimiter({
  windowMs: 60_000,
  max: 10,
});
const previewGate = createConcurrencyGate(2);

/**
 * Validates posted JSON against `InvoiceSchema` and streams a PDF preview.
 */
export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "access denied" }, { status: 403 });
  }

  const rate = previewLimiter.consume(clientIpKey(request));
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "request body too large" },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "request body too large" },
        { status: 413 },
      );
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const parsed = InvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invoice validation failed",
        issues: parsed.error.flatten(),
      },
      { status: 422 },
    );
  }

  let invoice = parsed.data;
  const lockedPreview = request.headers.get(LOCKED_PREVIEW_HEADER) === "1";
  if (!lockedPreview && !invoice.meta.issuedBy) {
    const session = await getOptionalSession();
    invoice = withIssuedBy(
      invoice,
      session ? issuedByFromProfile(session) : null,
    );
  }

  if (invoice.items.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `invoice may contain at most ${MAX_ITEMS} items` },
      { status: 422 },
    );
  }
  if (!previewGate.tryEnter()) {
    return NextResponse.json(
      { error: "preview service is busy" },
      { status: 503, headers: { "Retry-After": "2" } },
    );
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await renderInvoicePdf(invoice, {
      watermark: lockedPreview
        ? invoiceLabels(invoice.meta.language).previewWatermark
        : undefined,
    });
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
    return NextResponse.json({ error: "pdf render failed" }, { status: 500 });
  } finally {
    previewGate.leave();
  }

  const buffer = Buffer.from(pdfBytes);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="invoice-preview.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
