import {
  deleteExpiredGuestWorkspaces,
  guestRetentionCutoff,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

export const runtime = "nodejs";

/**
 * Daily guest-retention sweep (ADR 0048 §8).
 *
 * This is a hard delete of a stranger's personal data by design, not a soft
 * archive: an unclaimed guest workspace past the 12-month window is removed
 * — workspace row, invoices, clients, issuer businesses, and email messages —
 * rather than flagged, frozen, or moved to a bin. A guest who neither claimed
 * nor opened the mail is unrecoverable by design (ADR 0048 §"Negative"); this
 * cron is what actually enforces that, not merely documents it.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
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

  const cutoff = guestRetentionCutoff(new Date());
  const result = await deleteExpiredGuestWorkspaces(db, { cutoff });

  return Response.json({
    ok: true,
    deletedWorkspaces: result.deletedWorkspaces,
    cutoff,
  });
}
