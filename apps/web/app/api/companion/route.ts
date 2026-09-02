import {
  requireCompanionAuth,
  withCompanionContext,
} from "@/lib/auth/companion";
import { NextResponse } from "next/server";

import { recordToolActivity, tryCreateDbFromEnv } from "@invoicey/db";
import {
  CompanionRequestSchema,
  runCompanionOp,
} from "@invoicey/invoice-tools/companion";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const gate = await requireCompanionAuth(request);
  if ("response" in gate) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const result = await withCompanionContext(gate.identity, () =>
    runCompanionOp(body),
  );

  const parsed = CompanionRequestSchema.safeParse(body);
  const op = parsed.success ? parsed.data.op : "unknown";
  const database = tryCreateDbFromEnv();
  if (database && gate.identity.workspaceId) {
    try {
      await recordToolActivity(database, {
        workspaceId: gate.identity.workspaceId,
        userId: gate.identity.userId,
        product: "mcp",
        toolName: `cli.${op}`,
        metadata: { surface: "cli", isError: result.ok !== true },
      });
    } catch {
      /** metering must not break the companion */
    }
  }

  const status = result.ok ? 200 : result.error === "unauthorized" ? 401 : 200;
  return NextResponse.json(result, { status });
}
