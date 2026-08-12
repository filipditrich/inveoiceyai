import { sendInvoiceEmailById } from "@invoicey/invoice-tools/email";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { appOrigin } from "../lib/slack-thread";
import { withEveToolWorkspace } from "../lib/tool-workspace";

export default defineTool({
  description:
    "Email an issued invoice (PDF + optional ISDOC) to the client. Requires Slack Allow/Deny — check recipient (`to`) and invoice id on the approval card. Pass `to` when client has no contactEmail.",
  inputSchema: z.object({
    id: z.string().uuid(),
    to: z.string().email().optional(),
    cc: z.array(z.string().email()).optional(),
    coverText: z.string().optional(),
    attachIsdoc: z.boolean().optional(),
    subject: z.string().optional(),
  }),
  approval: always(),
  async execute(input, ctx) {
    return withEveToolWorkspace(ctx, async () => {
      const result = await sendInvoiceEmailById(input);
      if (!result.ok) return result;
      return {
        ...result,
        invoiceId: input.id,
        webUrl: `${appOrigin()}/invoices/${input.id}`,
      };
    });
  },
});
