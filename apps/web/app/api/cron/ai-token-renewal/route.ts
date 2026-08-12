import { renewDueAiTokenPeriods } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

export const runtime = "nodejs";

/** Daily AI monthly-token renewal. Auth: `Authorization: Bearer ${CRON_SECRET}`. */
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

  const result = await renewDueAiTokenPeriods(db);
  return Response.json({
    ok: true,
    renewed: result.renewed,
    workspaceIds: result.workspaceIds,
  });
}
