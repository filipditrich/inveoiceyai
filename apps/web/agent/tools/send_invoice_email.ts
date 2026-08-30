import { sendInvoiceEmailById } from "@invoicey/invoice-tools/email";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { appOrigin } from "../lib/slack-thread";
import { withEveToolWorkspace } from "../lib/tool-workspace";

export default defineTool({
  description:
    "Email an issued invoice (PDF + optional ISDOC) to the client. Requires Allow/Deny approval. Pass `confirm` with the invoice number and the client name — the approval prompt renders the tool input verbatim, and the reviewer needs to see who is about to receive it. Pass `to` when the client has no contactEmail.",
  inputSchema: z.object({
    id: z.string().uuid(),
    confirm: z
      .object({
        number: z.string().min(1).describe("Invoice number as shown"),
        clientName: z.string().min(1).describe("Client name as shown"),
      })
      .describe(
        "Shown to the human on the approval card. Copy, do not invent.",
      ),
    to: z.string().email().optional(),
    cc: z.array(z.string().email()).optional(),
    coverText: z.string().optional(),
    attachIsdoc: z.boolean().optional(),
    subject: z.string().optional(),
  }),
  approval: always(),
  async execute({ confirm: _confirm, ...input }, ctx) {
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
