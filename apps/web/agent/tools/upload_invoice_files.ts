import { renderInvoicePdf, renderIsdoc } from "@invoicey/invoice-core";
import { getInvoice } from "@invoicey/invoice-tools/ops";
import { defineTool } from "eve/tools";
import { z } from "zod";

import { slackThreadFromCtx } from "../lib/slack-thread";
import { withEveToolWorkspace } from "../lib/tool-workspace";
import { uploadInvoiceArtifacts } from "../lib/upload-slack-files";

export default defineTool({
  description:
    "Upload invoice PDF and ISDOC into the current Slack thread. Prefer invoiceId (re-renders from Neon).",
  inputSchema: z.object({
    invoiceId: z.string().uuid().optional(),
    filenamePdf: z.string().optional(),
    filenameIsdoc: z.string().optional(),
    pdfBase64: z.string().optional(),
    isdocXml: z.string().optional(),
    initialComment: z.string().optional(),
  }),
  async execute(input, ctx) {
    return withEveToolWorkspace(ctx, async () => {
      const thread = slackThreadFromCtx(ctx);
      if (!thread) {
        return {
          ok: false as const,
          error: "not a Slack session (missing channel_id / thread_ts)",
        };
      }

      let pdfBase64 = input.pdfBase64;
      let isdocXml = input.isdocXml;
      let filenamePdf = input.filenamePdf;
      let filenameIsdoc = input.filenameIsdoc;

      if ((!pdfBase64 || !isdocXml) && input.invoiceId) {
        const loaded = await getInvoice({ id: input.invoiceId });
        if (!loaded.ok || !loaded.invoice) {
          return {
            ok: false as const,
            error: loaded.ok ? "invoice payload missing" : loaded.error,
          };
        }
        const invoice = loaded.invoice;
        const pdfBytes = await renderInvoicePdf(invoice);
        isdocXml = renderIsdoc(invoice);
        pdfBase64 = Buffer.from(pdfBytes).toString("base64");
        const safeName = invoice.meta.number.replace(/[^\w.-]+/g, "_");
        filenamePdf ??= `faktura-${safeName}-isdoc.pdf`;
        filenameIsdoc ??= `faktura-${safeName}.isdoc`;
      }

      if (!pdfBase64 || !isdocXml) {
        return {
          ok: false as const,
          error: "provide invoiceId or pdfBase64 + isdocXml",
        };
      }

      return uploadInvoiceArtifacts({
        channelId: thread.channelId,
        threadTs: thread.threadTs,
        initialComment: input.initialComment,
        filenamePdf: filenamePdf ?? "faktura.pdf",
        filenameIsdoc: filenameIsdoc ?? "faktura.isdoc",
        pdfBase64,
        isdocXml,
      });
    });
  },
});
