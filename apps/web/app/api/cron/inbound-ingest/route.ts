import { inboxItems } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";
import { and, inArray, lt } from "drizzle-orm";

import { ingestInboxItem } from "@/lib/incoming-invoices/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const cutoff = new Date(Date.now() - 2 * 60 * 1000);
  const stuck = await db
    .select({ id: inboxItems.id })
    .from(inboxItems)
    .where(
      and(
        inArray(inboxItems.status, ["received", "processing"]),
        lt(inboxItems.receivedAt, cutoff),
      ),
    )
    .limit(20);
  for (const item of stuck) {
    await ingestInboxItem(item.id);
  }
  return Response.json({ ok: true, processed: stuck.length });
}
