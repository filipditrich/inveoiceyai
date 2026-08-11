import { createAndRenderInvoice } from "@invoicey/invoice-tools";
import { resolveDefaultIssuer } from "@invoicey/invoice-tools/ops";
import { defineTool } from "eve/tools";
import { z } from "zod";

import { appOrigin, slackThreadFromCtx } from "../lib/slack-thread";
import { uploadInvoiceArtifacts } from "../lib/upload-slack-files";

export default defineTool({
  description:
    "Assemble a draft invoice, persist to Neon when DATABASE_URL is set, and render PDF + ISDOC. Issuer is locked server-side. Uploads files automatically in a Slack thread.",
  inputSchema: z.object({
    draft: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        "Partial invoice: meta, client, vat, payment, items (issuer ignored). vat is required: { mode: regular|reverse_charge|oss, suppliesAbroad: none|eu|non_eu }. Domestic default: { mode: regular, suppliesAbroad: none }. Line vatRate does not replace vat.",
      ),
    issuerPresetId: z
      .string()
      .uuid()
      .optional()
      .describe("Preset id of kind issuer"),
    templatePresetId: z
      .string()
      .uuid()
      .optional()
      .describe("Preset id of kind invoice_template"),
  }),
  async execute({ draft, issuerPresetId, templatePresetId }, ctx) {
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
      total: result.invoice.totals.total,
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
  },
});
