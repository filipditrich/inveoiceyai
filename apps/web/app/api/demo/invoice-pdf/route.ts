import { InvoiceSchema, renderInvoicePdf } from "@invoicey/invoice-core";
import { checkBotId } from "botid/server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 128 * 1024;
const MAX_ITEMS = 100;
const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 10;
const MAX_CONCURRENT_RENDERS = 2;
const requestWindows = new Map<string, { count: number; resetAt: number }>();
let concurrentRenders = 0;

function clientKey(request: NextRequest): string {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",", 1)[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    "unknown"
  );
}

function consumeRequest(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  if (requestWindows.size >= 10_000) {
    for (const [storedKey, window] of requestWindows) {
      if (window.resetAt <= now) requestWindows.delete(storedKey);
    }
    if (requestWindows.size >= 10_000) {
      const oldestKey = requestWindows.keys().next().value as
        string | undefined;
      if (oldestKey) requestWindows.delete(oldestKey);
    }
  }
  const current = requestWindows.get(key);
  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

/**
 * Validates posted JSON against `InvoiceSchema` and streams a PDF preview.
 */
export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "access denied" }, { status: 403 });
  }

  const rate = consumeRequest(clientKey(request));
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
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

  if (parsed.data.items.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `invoice may contain at most ${MAX_ITEMS} items` },
      { status: 422 },
    );
  }
  if (concurrentRenders >= MAX_CONCURRENT_RENDERS) {
    return NextResponse.json(
      { error: "preview service is busy" },
      { status: 503, headers: { "Retry-After": "2" } },
    );
  }

  let pdfBytes: Uint8Array;
  concurrentRenders += 1;
  try {
    pdfBytes = await renderInvoicePdf(parsed.data);
  } catch {
    return NextResponse.json({ error: "pdf render failed" }, { status: 500 });
  } finally {
    concurrentRenders -= 1;
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
