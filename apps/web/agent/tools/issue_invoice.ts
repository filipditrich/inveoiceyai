import { renderInvoicePdf, renderIsdoc } from "@invoicey/invoice-core";
import { issueInvoiceById } from "@invoicey/invoice-tools/ops";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { appOrigin, slackThreadFromCtx } from "../lib/slack-thread";
import { withEveToolWorkspace } from "../lib/tool-workspace";
import { uploadInvoiceArtifacts } from "../lib/upload-slack-files";

export default defineTool({
  description:
    "Issue a draft invoice (atomic numbering). Requires Slack approval. Uploads issued PDF/ISDOC when in a Slack thread.",
  inputSchema: z.object({
    id: z.string().uuid().describe("Draft invoice id"),
  }),
  approval: always(),
  async execute({ id }, ctx) {
    return withEveToolWorkspace(ctx, async () => {
      const result = await issueInvoiceById({ id });
      if (!result.ok) return result;

      const pdfBytes = await renderInvoicePdf(result.invoice);
      const isdocXml = renderIsdoc(result.invoice);
      const safeName = result.invoice.meta.number.replace(/[^\w.-]+/g, "_");
      const filenamePdf = `faktura-${safeName}-isdoc.pdf`;
      const filenameIsdoc = `faktura-${safeName}.isdoc`;
      const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

      const thread = slackThreadFromCtx(ctx);
      const upload = thread
        ? await uploadInvoiceArtifacts({
            channelId: thread.channelId,
            threadTs: thread.threadTs,
            filenamePdf,
            filenameIsdoc,
            pdfBase64,
            isdocXml,
          })
        : null;

      return {
        ok: true as const,
        alreadyIssued: result.alreadyIssued,
        summary: result.summary,
        invoiceId: id,
        number: result.invoice.meta.number,
        filenamePdf,
        filenameIsdoc,
        webUrl: `${appOrigin()}/invoices/${id}`,
        uploadedToSlack: upload?.ok === true,
        uploadError: upload && !upload.ok ? upload.error : null,
      };
    });
  },
});
