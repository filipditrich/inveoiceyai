import { lookupAresByIcoCached } from "@/lib/cached-ares";
import { clientIpKey, createFixedWindowLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

import { IcoSchema } from "@invoicey/invoice-core/schema";

export const runtime = "nodejs";

const aresLimiter = createFixedWindowLimiter({ windowMs: 60_000, max: 20 });

/**
 * Public ARES lookup for the free generator. The authenticated `/api/ares`
 * route stays session-gated so Invoicey is not an unmetered relay; this path
 * is IP-burst limited instead. BotID guards the issue/preview endpoints
 * (ADR 0048), not this read-only lookup.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ ico: string }> },
) {
  const rate = aresLimiter.consume(clientIpKey(request));
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const raw = (await context.params).ico ?? "";
  let icoParsed: string;
  try {
    icoParsed = IcoSchema.parse(raw.trim());
  } catch {
    return NextResponse.json(
      { error: "invalid ico", message: raw },
      { status: 422 },
    );
  }

  const result = await lookupAresByIcoCached(icoParsed);
  const status = result.ok
    ? 200
    : result.kind === "not_found"
      ? 404
      : result.kind === "invalid_ico"
        ? 422
        : result.httpStatus !== undefined &&
            result.httpStatus >= 400 &&
            result.httpStatus < 600
          ? result.httpStatus
          : 502;
  return NextResponse.json(result, { status });
}
