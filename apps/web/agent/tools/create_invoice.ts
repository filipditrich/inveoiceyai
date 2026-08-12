import { createAndRenderInvoice } from "@invoicey/invoice-tools";
import { resolveDefaultIssuer } from "@invoicey/invoice-tools/ops";
import { defineTool } from "eve/tools";

import { CreateInvoiceInputSchema } from "../lib/create-invoice-input";
import { appOrigin, slackThreadFromCtx } from "../lib/slack-thread";
import { withEveToolWorkspace } from "../lib/tool-workspace";
import { uploadInvoiceArtifacts } from "../lib/upload-slack-files";

export default defineTool({
  description:
    "Assemble a draft invoice, persist to Neon when DATABASE_URL is set, and render PDF + ISDOC. Issuer is locked server-side. Uploads files automatically in a Slack thread. Call only with a complete draft: meta, client (structured address from ARES), vat, payment.method, and items. Do not omit vat or payment to probe validation.",
  inputSchema: CreateInvoiceInputSchema,
  async execute({ draft, issuerPresetId, templatePresetId }, ctx) {
    return withEveToolWorkspace(ctx, async () => {
      const issuer = issuerPresetId ? undefined : await resolveDefaultIssuer();
      const result = await createAndRenderInvoice({
        draft,
        issuerPresetId,
        templatePresetId,
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
