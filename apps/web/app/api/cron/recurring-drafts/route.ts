import { pragueTodayIso } from "@/lib/invoice-status-sql";
import { and, isNull } from "drizzle-orm";

import { notUnclaimedWorkspaces, workspaces } from "@invoicey/db";
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
  const workspaceRows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    // Unclaimed guest workspaces (ADR 0048 §2) never have a recurring
    // template, but they must not be swept into daily work regardless.
    .where(and(isNull(workspaces.frozenAt), notUnclaimedWorkspaces()));

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
