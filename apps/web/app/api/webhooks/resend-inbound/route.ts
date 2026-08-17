import { inboxAliases, inboxItems } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";
import { parseResendInboundEvent } from "@invoicey/invoice-tools/email";
import { and, eq, gte, sql } from "drizzle-orm";
import { Webhook } from "svix";

import { ingestInboxItem } from "@/lib/incoming-invoices/ingest";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const secret = env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json(
      { error: "RESEND_INBOUND_WEBHOOK_SECRET is not configured" },
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

  let event: { type?: string; data?: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type?: string; data?: Record<string, unknown> };
  } catch {
    return Response.json(
      { error: "invalid signature or payload" },
      { status: 400 },
    );
  }

  const parsed = parseResendInboundEvent({
    type: event.type,
    data: event.data,
    emailIdFallback: svixId,
  });
  if ("ignored" in parsed) {
    return Response.json({ ok: true, ignored: parsed.ignored });
  }

  const { notification } = parsed;
  const localPart = notification.recipient?.split("@")[0]?.toLowerCase();
  if (!localPart) {
    return Response.json({ ok: true, ignored: "unknown_alias" });
  }
  const [alias] = await db
    .select()
    .from(inboxAliases)
    .where(
      and(
        eq(inboxAliases.localPart, localPart),
        eq(inboxAliases.isActive, true),
      ),
    )
    .limit(1);
  if (!alias) {
    return Response.json({ ok: true, ignored: "unknown_alias" });
  }

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [{ value: todayCount }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(inboxItems)
    .where(
      and(
        eq(inboxItems.workspaceId, alias.workspaceId),
        eq(inboxItems.source, "email"),
        gte(inboxItems.receivedAt, dayStart),
      ),
    );
  const cap = env.INVOICEY_INBOUND_MAX_MESSAGES_PER_DAY ?? 200;
  const overCap = Number(todayCount ?? 0) >= cap;

  const [inserted] = await db
    .insert(inboxItems)
    .values({
      workspaceId: alias.workspaceId,
      source: "email",
      aliasId: alias.id,
      issuerId: alias.issuerId,
      providerMessageId: notification.providerMessageId,
      fromAddress: notification.fromAddress,
      subject: notification.subject,
      toAddresses: notification.recipient ? [notification.recipient] : [],
      status: overCap ? "rejected" : "received",
      errorCode: overCap ? "rate_limited" : null,
    })
    .onConflictDoNothing()
    .returning({ id: inboxItems.id });

  if (inserted && !overCap) {
    void ingestInboxItem(inserted.id).catch((error: unknown) => {
      console.error("[resend-inbound] ingest", error);
    });
  }

  return Response.json({ ok: true, inboxItemId: inserted?.id ?? null });
}
