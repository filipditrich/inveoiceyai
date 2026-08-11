import { workspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

import {
  listOverdueInvoiceIdsForReminders,
  sendOverdueReminderForInvoice,
} from "@/lib/email/send-invoice";
import { pragueTodayIso } from "@/lib/invoice-status-sql";

export const runtime = "nodejs";

/** Daily overdue reminders. Auth: `Authorization: Bearer ${CRON_SECRET}`. */
export async function GET(request: Request): Promise<Response> {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const todayIso = pragueTodayIso();
  const workspaceRows = await db.select({ id: workspaces.id }).from(workspaces);

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const ws of workspaceRows) {
    const ids = await listOverdueInvoiceIdsForReminders({
      db,
      workspaceId: ws.id,
      todayIso,
    });
    for (const invoiceId of ids) {
      const result = await sendOverdueReminderForInvoice({
        db,
        workspaceId: ws.id,
        invoiceId,
      });
      if (result.ok) {
        sent += 1;
      } else {
        skipped += 1;
        if (
          result.error !== "reminder_window" &&
          result.error !== "suppressed" &&
          result.error !== "missing_recipient" &&
          result.error !== "reminders_disabled" &&
          result.error !== "not_eligible"
        ) {
          errors.push(`${invoiceId}: ${result.error}`);
        }
      }
    }
  }

  return Response.json({ ok: true, sent, skipped, errors, todayIso });
}
