import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import {
  invoiceArtifactFileNamesFromInvoice,
  renderInvoicePdf,
  renderIsdoc,
} from "@invoicey/invoice-core";
import { issueInvoiceById } from "@invoicey/invoice-tools/ops";

import { buildInvoiceCardModel } from "../lib/invoice-card-model";
import { appOrigin, slackThreadFromCtx } from "../lib/slack-thread";
import { withEveToolWorkspace } from "../lib/tool-workspace";
import { uploadInvoiceArtifacts } from "../lib/upload-slack-files";

export default defineTool({
  description:
    "Issue a draft invoice (atomic numbering, immutable afterwards). Requires Allow/Deny approval. Pass `confirm` with the client name and total exactly as shown on the draft card — the approval prompt renders the tool input verbatim, so without it the reviewer is approving a bare id. Files are uploaded by the card's buttons, not here.",
  inputSchema: z.object({
    id: z.string().uuid().describe("Draft invoice id"),
    confirm: z
      .object({
        clientName: z
          .string()
          .min(1)
          .describe("Client name as shown on the draft card"),
        total: z
          .string()
          .min(1)
          .describe("Total with currency, e.g. `12 100,00 CZK`"),
      })
      .describe(
        "Shown to the human on the approval card. Copy from the draft card; do not invent.",
      ),
  }),
  approval: always(),
  async execute({ id, confirm }, ctx) {
    return withEveToolWorkspace(ctx, async () => {
      const result = await issueInvoiceById({ id });
      if (!result.ok) return result;

      /**
       * The approval card showed `confirm`. If it did not describe this
       * invoice, the human approved something other than what ran — say so
       * rather than reporting a clean success.
       */
      const actualClient = result.invoice.client.name;
      const mismatch =
        actualClient.trim().toLowerCase() !==
        confirm.clientName.trim().toLowerCase();

      /** Issuing freezes the document, so this PDF is the one worth keeping. */
      const names = invoiceArtifactFileNamesFromInvoice(result.invoice);
      const filenamePdf = names.pdf;
      const filenameIsdoc = names.isdoc;
      const thread = slackThreadFromCtx(ctx);
      const upload = thread
        ? await uploadInvoiceArtifacts({
            channelId: thread.channelId,
            threadTs: thread.threadTs,
            filenamePdf,
            filenameIsdoc,
            pdfBase64: Buffer.from(
              await renderInvoicePdf(result.invoice),
            ).toString("base64"),
            isdocXml: renderIsdoc(result.invoice),
          })
        : null;

      const webUrl = `${appOrigin()}/invoices/${id}`;
      return {
        ok: true as const,
        alreadyIssued: result.alreadyIssued,
        summary: result.summary,
        invoiceId: id,
        number: result.invoice.meta.number,
        filenamePdf,
        filenameIsdoc,
        uploadedToSlack: upload?.ok === true,
        uploadError: upload && !upload.ok ? upload.error : null,
        confirmMismatch: mismatch
          ? `approval card said "${confirm.clientName}" but the invoice is for "${actualClient}" — tell the user`
          : null,
        webUrl,
        card: buildInvoiceCardModel({
          invoice: result.invoice,
          invoiceId: id,
          state: "issued",
          webUrl,
        }),
      };
    });
  },
});
