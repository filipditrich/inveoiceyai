import { checkGuestEmail } from "@/lib/generator/email-address";
import { issueGuestInvoice } from "@/lib/generator/issue-guest-invoice";
import { GuestTokenSecretMissingError } from "@/lib/generator/tokens";
import { clientIpKey, createFixedWindowLimiter } from "@/lib/rate-limit";
import { checkBotId } from "botid/server";
import { type NextRequest, NextResponse } from "next/server";

import { InvoiceSchema } from "@invoicey/invoice-core/schema";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 128 * 1024;
const issueLimiter = createFixedWindowLimiter({
  windowMs: 10 * 60_000,
  max: 5,
});

function jsonError(error: string, status: number, extra?: object) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function emailError(reason: "invalid" | "disposable" | "undeliverable") {
  if (reason === "disposable") return jsonError("disposable_email", 422);
  if (reason === "undeliverable") return jsonError("undeliverable_email", 422);
  return jsonError("invalid_email", 422);
}

export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return jsonError("bot", 403);
  }

  const rate = issueLimiter.consume(clientIpKey(request));
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonError("payload_too_large", 413);
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return jsonError("payload_too_large", 413);
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return jsonError("invoice_invalid", 422);
  }

  if (typeof body !== "object" || body === null) {
    return jsonError("invoice_invalid", 422);
  }
  const payload = body as {
    invoice?: unknown;
    email?: unknown;
    marketingOptIn?: unknown;
  };

  const emailCheck = await checkGuestEmail(
    typeof payload.email === "string" ? payload.email : "",
  );
  if (!emailCheck.ok) {
    return emailError(emailCheck.reason);
  }

  const parsed = InvoiceSchema.safeParse(payload.invoice);
  if (!parsed.success) {
    return jsonError("invoice_invalid", 422, {
      issues: parsed.error.flatten(),
    });
  }

  try {
    const result = await issueGuestInvoice({
      invoice: parsed.data,
      email: emailCheck.email,
      marketingOptIn: payload.marketingOptIn === true,
    });
    if (!result.ok) {
      if (result.reason === "allowance_exhausted") {
        return NextResponse.json(
          {
            ok: false,
            error: "allowance_exhausted",
            period: result.period,
          },
          { status: 429 },
        );
      }
      if (result.reason === "invoice_invalid") {
        return jsonError("invoice_invalid", 422, { issues: result.issues });
      }
      return jsonError("unavailable", 503);
    }
    return NextResponse.json({
      ok: true,
      invoiceId: result.invoiceId,
      number: result.number,
      downloadUrl: `/api/generator/invoice/${result.downloadToken}`,
      mailed: result.mailed,
    });
  } catch (error) {
    if (error instanceof GuestTokenSecretMissingError) {
      return jsonError("unavailable", 503);
    }
    console.error("[invoicey] generator issue route failed", error);
    return jsonError("unavailable", 503);
  }
}
