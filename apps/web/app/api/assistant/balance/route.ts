import { requireWorkspaceForRoute } from "@/lib/auth/api";
import { type NextRequest, NextResponse } from "next/server";

import { getWorkspaceTokenSummary } from "@invoicey/db";
import { db } from "@invoicey/db/client";

export const runtime = "nodejs";

/**
 * Token balance after a turn.
 *
 * The Eve stream carries no token accounting — metering happens in the agent's
 * `step.completed` hook — so the panel re-reads the workspace summary once a
 * turn settles rather than trying to predict the debit.
 */
export async function GET(request: NextRequest) {
  const gate = await requireWorkspaceForRoute(request);
  if ("response" in gate) {
    return gate.response;
  }

  const summary = await getWorkspaceTokenSummary(db, gate.context.workspaceId);
  return NextResponse.json({
    balance: {
      giftedRemaining: summary.giftedRemaining,
      monthlyRemaining: summary.monthlyRemaining,
      monthlyLimit: summary.monthlyLimit,
      purchasedRemaining: summary.purchasedRemaining,
      totalAvailable: summary.totalAvailable,
      daysUntilRenewal: summary.daysUntilRenewal,
    },
  });
}
