import { requireDriveDevice } from "@/lib/drive/device-auth";
import { proxyStoredFile } from "@/lib/serve-invoice-file";
import { NextResponse } from "next/server";

import { getDriveInvoiceArtifact, getDriveUserSettings } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { applyDriveLayout } from "@invoicey/invoice-core";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, ctx: { params: Params }) {
  const gate = await requireDriveDevice(request);
  if ("response" in gate) {
    return gate.response;
  }
  const { id } = await ctx.params;
  const settings = await getDriveUserSettings(db, gate.device.userId);
  const artifact = await getDriveInvoiceArtifact({
    db,
    userId: gate.device.userId,
    invoiceId: id,
  });
  if (!artifact?.isdocUrl || !settings.includeIsdoc) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const layout = applyDriveLayout({
    template: settings.layoutTemplate,
    issueDate: artifact.issueDate,
    number: artifact.number ?? id,
    language: artifact.language,
    docType: artifact.docType,
    clientName: artifact.clientName,
  });
  try {
    return await proxyStoredFile(
      artifact.isdocUrl,
      `${layout.stem}.isdoc`,
      "application/xml; charset=utf-8",
      "attachment",
      artifact.isdocSha256,
    );
  } catch {
    return NextResponse.json({ error: "isdoc_unavailable" }, { status: 502 });
  }
}
