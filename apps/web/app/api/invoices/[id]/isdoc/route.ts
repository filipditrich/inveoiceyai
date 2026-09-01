import { requireWorkspaceForRoute } from "@/lib/auth/api";
import { serveInvoiceIsdoc } from "@/lib/serve-invoice-file";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { invoices, issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const gate = await requireWorkspaceForRoute(request);
  if ("response" in gate) {
    return gate.response;
  }
  const { workspaceId } = gate.context;
  const rows = await db
    .select({
      invoice: invoices,
      emailSettings: issuerBusinesses.emailSettings,
    })
    .from(invoices)
    .leftJoin(
      issuerBusinesses,
      and(
        eq(issuerBusinesses.id, invoices.issuerId),
        eq(issuerBusinesses.workspaceId, invoices.workspaceId),
      ),
    )
    .where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    return await serveInvoiceIsdoc(
      row.invoice,
      "attachment",
      row.emailSettings?.filenameTemplate,
    );
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "isdoc render failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
