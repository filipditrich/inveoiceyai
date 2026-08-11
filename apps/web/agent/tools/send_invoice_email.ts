import { sendInvoiceEmailById } from "@invoicey/invoice-tools/email";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

export default defineTool({
  description:
    "Email an issued invoice (PDF + optional ISDOC) to the client. Requires Slack approval. Pass `to` when client has no contactEmail.",
  inputSchema: z.object({
    id: z.string().uuid(),
    to: z.string().email().optional(),
    cc: z.array(z.string().email()).optional(),
    coverText: z.string().optional(),
    attachIsdoc: z.boolean().optional(),
    subject: z.string().optional(),
  }),
  approval: always(),
  async execute(input) {
    return sendInvoiceEmailById(input);
  },
});
