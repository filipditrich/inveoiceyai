import { createAndRenderInvoice } from "@invoicey/invoice-tools";
import { resolveDefaultIssuer } from "@invoicey/invoice-tools/ops";
import { defineTool } from "eve/tools";

import { CreateInvoiceInputSchema } from "../lib/create-invoice-input";
import { appOrigin, slackThreadFromCtx } from "../lib/slack-thread";
import { withEveToolWorkspace } from "../lib/tool-workspace";
import { uploadInvoiceArtifacts } from "../lib/upload-slack-files";

export default defineTool({
  description:
    "Assemble a draft invoice, persist to Neon when DATABASE_URL is set, and render PDF + ISDOC. Issuer is locked server-side (do not pass issuer, issuerPresetId, or templatePresetId — those fields do not exist). Uploads files automatically in a Slack thread. Call only with draft: meta, client (structured address from ARES), vat, payment.method, and items.",
  inputSchema: CreateInvoiceInputSchema,
  async execute({ draft }, ctx) {
    return withEveToolWorkspace(ctx, async () => {
      const issuer = await resolveDefaultIssuer();
      if (!issuer) {
        return {
          ok: false as const,
          error:
            "no issuer in this workspace — create one in Invoicey before drafting",
        };
      }
      const result = await createAndRenderInvoice({
        draft,
        issuer,
      });
      if (!result.ok) return result;

      const thread = slackThreadFromCtx(ctx);
      const upload = thread
        ? await uploadInvoiceArtifacts({
            channelId: thread.channelId,
            threadTs: thread.threadTs,
            filenamePdf: result.filenamePdf,
            filenameIsdoc: result.filenameIsdoc,
            pdfBase64: result.pdfBase64,
            isdocXml: result.isdocXml,
          })
        : null;

      return {
        ok: true as const,
        invoiceId: result.invoiceId ?? null,
        number: result.invoice.meta.number,
        total: String(result.invoice.totals.total),
        currency: result.invoice.meta.currency,
        clientName: result.invoice.client.name,
        filenamePdf: result.filenamePdf,
        filenameIsdoc: result.filenameIsdoc,
        webUrl: result.invoiceId
          ? `${appOrigin()}/invoices/${result.invoiceId}`
          : null,
        uploadedToSlack: upload?.ok === true,
        uploadError: upload && !upload.ok ? upload.error : null,
      };
    });
  },
});
