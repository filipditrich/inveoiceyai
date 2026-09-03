import { getPolarCatalog } from "@/lib/billing/catalog";
import { normalizePolarEvent } from "@/lib/billing/normalize";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";

import {
  applyNormalizedBillingEvent,
  claimWebhookEvent,
  finishWebhookEvent,
} from "@invoicey/db";
import { withDbTransaction } from "@invoicey/db/transaction";

export const runtime = "nodejs";

function headerRecord(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

function asEventEnvelope(payload: string): { type: string; data: unknown } {
  try {
    const parsed = JSON.parse(payload) as { type?: string; data?: unknown };
    return { type: parsed.type ?? "unknown", data: parsed.data };
  } catch {
    return { type: "unknown", data: null };
  }
}

export async function POST(request: Request): Promise<Response> {
  const catalog = getPolarCatalog();
  if (!catalog) {
    return Response.json(
      { error: "Polar billing is not configured" },
      { status: 503 },
    );
  }

  const payload = await request.text();
  let event: { type: string; data: unknown };
  try {
    /** SAFETY: Polar's helper returns a typed union; we only need type + data. */
    event = validateEvent(
      payload,
      headerRecord(request),
      catalog.webhookSecret,
    ) as { type: string; data: unknown };
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return Response.json({ error: "invalid signature" }, { status: 403 });
    }
    /** signature passed; Polar added an event type we do not model yet */
    if (error instanceof Error && error.name === "SDKValidationError") {
      event = asEventEnvelope(payload);
    } else {
      console.error("[polar webhook] verify failed", error);
      return Response.json({ error: "invalid payload" }, { status: 400 });
    }
  }

  const providerEventId =
    request.headers.get("webhook-id") ??
    request.headers.get("Webhook-Id") ??
    crypto.randomUUID();

  const parsed = (() => {
    try {
      return JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return { type: event.type };
    }
  })();

  try {
    const result = await withDbTransaction(async (tx) => {
      const claimed = await claimWebhookEvent(tx, {
        providerEventId,
        eventType: event.type,
        payload: parsed,
      });
      if (claimed.outcome === "duplicate") {
        return { duplicate: true as const };
      }

      const normalized = normalizePolarEvent(
        event.type,
        event.data,
        catalog.products,
      );
      const applied = await applyNormalizedBillingEvent(tx, {
        environment: catalog.environment,
        event: normalized,
      });
      await finishWebhookEvent(tx, {
        eventId: claimed.eventId,
        state: applied.applied ? "processed" : "ignored",
      });
      return { duplicate: false as const, ...applied };
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[polar webhook] apply failed", error);
    return Response.json({ error: "processing failed" }, { status: 500 });
  }
}
