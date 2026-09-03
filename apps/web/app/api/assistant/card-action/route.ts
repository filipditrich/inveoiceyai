import {
  isInvoiceCardActionId,
  runInvoiceCardAction,
} from "@/agent/lib/invoice-card-actions";
import { requireWorkspaceForRoute } from "@/lib/auth/api";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getWorkspaceFreeze, isFrozen } from "@invoicey/db";
import { db } from "@invoicey/db/client";

export const runtime = "nodejs";

/**
 * The assistant panel's review-card controls.
 *
 * Same effect as clicking the equivalent button in Slack: `runInvoiceCardAction`
 * is the shared implementation, and the model is not in the loop on either
 * surface. The click is authorized as the signed-in user against their own
 * workspace — never against whatever the card claims.
 */
const BodySchema = z.object({
  action: z.string().refine(isInvoiceCardActionId, "unknown action"),
  invoiceId: z.string().uuid(),
  /** `change` only: which draft field the chosen option targets. */
  field: z.enum(["d", "c", "l", "v"]).optional(),
  value: z.string().max(200).nullish(),
  /**
   * Carried from the card that was clicked so the rebuilt card keeps flagging
   * the fields the user has not addressed yet.
   */
  assumedPaths: z.array(z.string().max(64)).max(32).optional(),
});

export async function POST(request: NextRequest) {
  const gate = await requireWorkspaceForRoute(request);
  if ("response" in gate) {
    return gate.response;
  }
  const { workspaceId, userId } = gate.context;
  const freeze = await getWorkspaceFreeze(db, workspaceId);
  if (freeze == null || isFrozen(freeze.frozenAt)) {
    return NextResponse.json({ error: "workspace_frozen" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const result = await runInvoiceCardAction({
    action: parsed.data.action,
    invoiceId: parsed.data.invoiceId,
    field: parsed.data.field,
    value: parsed.data.value,
    assumedPaths: parsed.data.assumedPaths,
    principal: { workspaceId, userId },
  });

  if (!result.ok) {
    /** A refused action is a normal outcome here, not a server fault. */
    return NextResponse.json({ ok: false, message: result.message });
  }

  return NextResponse.json(result);
}
