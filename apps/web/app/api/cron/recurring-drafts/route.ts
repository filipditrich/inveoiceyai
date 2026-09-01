import { pragueTodayIso } from "@/lib/invoice-status-sql";

import { workspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";
import { runDueRecurringForWorkspace } from "@invoicey/invoice-tools/ops";

export const runtime = "nodejs";

/** Daily recurring drafts. Auth: `Authorization: Bearer ${CRON_SECRET}`. */
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

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const ws of workspaceRows) {
    const result = await runDueRecurringForWorkspace({
      workspaceId: ws.id,
      todayIso,
    });
    created += result.created;
    skipped += result.skipped;
    errors.push(...result.errors);
  }

  return Response.json({ ok: true, created, skipped, errors, todayIso });
}
