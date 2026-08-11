import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";
import { Webhook } from "svix";

import { applyResendWebhookEvent } from "@/lib/email/webhook";

export const runtime = "nodejs";

/**
 * Resend delivery webhooks (Svix-signed).
 * @see docs/specs/email.md
 */
export async function POST(request: Request): Promise<Response> {
  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json(
      { error: "RESEND_WEBHOOK_SECRET is not configured" },
      { status: 503 },
    );
  }

  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: "missing svix headers" }, { status: 400 });
  }

  try {
    const wh = new Webhook(secret);
    const event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type: string; created_at?: string; data?: Record<string, unknown> };

    const result = await applyResendWebhookEvent({
      db,
      providerEventId: svixId,
      payload: event,
    });

    if (!result.ok) {
      /** acknowledge so Resend does not hammer retries for orphan events */
      return Response.json({ ok: true, ignored: result.error });
    }

    return Response.json({ ok: true, kind: result.kind });
  } catch (err) {
    console.error("[resend webhook]", err);
    return Response.json(
      { error: "invalid signature or payload" },
      { status: 400 },
    );
  }
}
