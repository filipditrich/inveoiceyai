import { inboxItems, incomingDocuments } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";
import {
  getInboundCaptureAdapter,
  type InboundCaptureAdapter,
  type InboundReceivedEmail,
} from "@invoicey/invoice-tools/email";
import { eq } from "drizzle-orm";

import { parseForwardedFrom } from "./classify";
import { processIncomingDocument } from "./process-document";

export { parseForwardedFrom };

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/xml",
  "text/xml",
  "application/zip",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export type { InboundReceivedEmail };

export async function ingestInboxItem(
  inboxItemId: string,
  deps: {
    capture?: InboundCaptureAdapter;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<void> {
  const [item] = await db
    .select()
    .from(inboxItems)
    .where(eq(inboxItems.id, inboxItemId))
    .limit(1);
  if (!item || item.status === "processed" || item.status === "no_invoice") {
    return;
  }
  await db
    .update(inboxItems)
    .set({ status: "processing" })
    .where(eq(inboxItems.id, item.id));

  try {
    const capture =
      deps.capture ?? getInboundCaptureAdapter({ fetchImpl: deps.fetchImpl });
    const email = item.providerMessageId
      ? await capture.fetchReceivedEmail(item.providerMessageId, deps.fetchImpl)
      : {};
    const bodyText = (email.text ?? email.html ?? "").slice(0, 4000);
    const headers = email.headers ?? {};
    await db
      .update(inboxItems)
      .set({
        bodyText,
        rfcMessageId: headers["message-id"] ?? item.rfcMessageId,
        parsedOriginalFrom: parseForwardedFrom(bodyText),
        authResults: {
          spf: headers["received-spf"] ?? headers.spf,
          dkim: headers["dkim-result"] ?? headers.dkim,
          dmarc: headers["dmarc-result"] ?? headers.dmarc,
        },
      })
      .where(eq(inboxItems.id, item.id));

    const attachments = (email.attachments ?? []).slice(0, 20);
    const maxBytes = env.INVOICEY_INBOUND_MAX_ATTACHMENT_BYTES ?? 20_971_520;
    let invoiceCount = 0;
    for (const attachment of attachments) {
      const mime = attachment.contentType ?? "application/octet-stream";
      if (!ALLOWED_MIME.has(mime)) continue;
      if ((attachment.size ?? 0) > maxBytes) continue;
      if (!attachment.downloadUrl) continue;
      const stored = await processIncomingDocument({
        workspaceId: item.workspaceId,
        inboxItemId: item.id,
        issuerId: item.issuerId,
        fileUrl: attachment.downloadUrl,
        fileName: attachment.filename ?? "attachment",
        mimeType: mime,
        subject: item.subject,
      });
      if (stored.invoiceId) invoiceCount += 1;
    }

    const docs = await db
      .select({ id: incomingDocuments.id })
      .from(incomingDocuments)
      .where(eq(incomingDocuments.inboxItemId, item.id));
    await db
      .update(inboxItems)
      .set({
        status: invoiceCount > 0 ? "processed" : "no_invoice",
        documentCount: docs.length,
      })
      .where(eq(inboxItems.id, item.id));
  } catch (error) {
    await db
      .update(inboxItems)
      .set({
        status: "failed",
        errorCode:
          error instanceof Error ? error.message.slice(0, 80) : "ingest_failed",
      })
      .where(eq(inboxItems.id, item.id));
  }
}
