import {
  requireCompanionAuth,
  withCompanionContext,
} from "@/lib/auth/companion";
import {
  parseFileDisposition,
  serveInvoicePdf,
} from "@/lib/serve-invoice-file";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { invoices, issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { loadInvoiceRowByRef } from "@invoicey/invoice-tools/companion";

export const runtime = "nodejs";

type Params = Promise<{ ref: string }>;

export async function GET(request: NextRequest, ctx: { params: Params }) {
  const { ref } = await ctx.params;
  const gate = await requireCompanionAuth(request);
  if ("response" in gate) return gate.response;

  const loaded = await withCompanionContext(gate.identity, () =>
    loadInvoiceRowByRef(decodeURIComponent(ref)),
  );
  if (!loaded.ok) {
    return NextResponse.json(loaded, { status: 404 });
  }

  const disposition = parseFileDisposition(
    request.nextUrl.searchParams.get("disposition"),
  );
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
    .where(
      and(
        eq(invoices.id, loaded.row.id),
        eq(invoices.workspaceId, gate.identity.workspaceId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return NextResponse.json(
      { ok: false, error: "not found" },
      { status: 404 },
    );
  }

  try {
    return await serveInvoicePdf(
      row.invoice,
      disposition,
      row.emailSettings?.filenameTemplate,
    );
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "pdf render failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
