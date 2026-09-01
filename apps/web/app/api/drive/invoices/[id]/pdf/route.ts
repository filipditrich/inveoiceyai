import { requireDriveDevice } from "@/lib/drive/device-auth";
import { serveInvoicePdf } from "@/lib/serve-invoice-file";
import { NextResponse } from "next/server";

import { getDriveIssuedInvoice } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { tryPersistInvoiceArtifacts } from "@invoicey/invoice-tools/artifacts";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, ctx: { params: Params }) {
  const gate = await requireDriveDevice(request);
  if ("response" in gate) {
    return gate.response;
  }
  const { id } = await ctx.params;
  let row = await getDriveIssuedInvoice({
    db,
    userId: gate.device.userId,
    invoiceId: id,
  });
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!row.pdfUrl) {
    await tryPersistInvoiceArtifacts({
      id: row.id,
      workspaceId: row.workspaceId,
    });
    row =
      (await getDriveIssuedInvoice({
        db,
        userId: gate.device.userId,
        invoiceId: id,
      })) ?? row;
  }
  try {
    return await serveInvoicePdf(row, "attachment");
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "pdf render failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
