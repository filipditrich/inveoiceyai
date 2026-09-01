import { syncFioConnection } from "@/lib/payments/fio-service";
import { syncMonetaConnection } from "@/lib/payments/moneta-service";
import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";

import { bankConnections } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Scheduled workspace-scoped bank imports. Leases make overlapping runs harmless. */
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

  const now = new Date();
  const due = await db
    .select({
      id: bankConnections.id,
      workspaceId: bankConnections.workspaceId,
      provider: bankConnections.provider,
    })
    .from(bankConnections)
    .where(
      and(
        inArray(bankConnections.provider, ["fio", "moneta"]),
        eq(bankConnections.status, "active"),
        or(
          isNull(bankConnections.nextSyncAt),
          lte(bankConnections.nextSyncAt, now),
        ),
      ),
    )
    .orderBy(asc(bankConnections.nextSyncAt))
    .limit(20);

  let imported = 0;
  let proposed = 0;
  let autoMatched = 0;
  const errors: Array<{ connectionId: string; code: string }> = [];
  for (const connection of due) {
    const result =
      connection.provider === "moneta"
        ? await syncMonetaConnection({
            workspaceId: connection.workspaceId,
            connectionId: connection.id,
          })
        : await syncFioConnection({
            workspaceId: connection.workspaceId,
            connectionId: connection.id,
          });
    imported += result.imported;
    proposed += result.proposed;
    autoMatched += result.autoMatched;
    if (!result.ok) {
      errors.push({
        connectionId: connection.id,
        code: result.error ?? `${connection.provider}_sync_failed`,
      });
    }
  }
  return Response.json({
    ok: errors.length === 0,
    connections: due.length,
    imported,
    proposed,
    autoMatched,
    errors,
  });
}
