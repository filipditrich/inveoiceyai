import { verifyGuestToken } from "@/lib/generator/tokens";
import { serveInvoiceIsdoc, serveInvoicePdf } from "@/lib/serve-invoice-file";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { invoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";

export const runtime = "nodejs";

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const payload = verifyGuestToken(token, "download");
  if (!payload) return notFound();

  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, payload.i), eq(invoices.workspaceId, payload.w)))
    .limit(1);
  if (!row) return notFound();

  const format = request.nextUrl.searchParams.get("format");
  const response =
    format === "isdoc"
      ? await serveInvoiceIsdoc(row, "attachment")
      : await serveInvoicePdf(row, "attachment");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
