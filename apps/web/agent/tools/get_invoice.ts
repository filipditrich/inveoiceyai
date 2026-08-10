import { getInvoice } from "@invoicey/invoice-tools/ops";
import { defineTool } from "eve/tools";
import { z } from "zod";

import { appOrigin } from "../lib/slack-thread";

export default defineTool({
  description: "Get one invoice by id (summary + payload when available).",
  inputSchema: z.object({
    id: z.string().uuid(),
  }),
  async execute({ id }) {
    const result = await getInvoice({ id });
    if (!result.ok) return result;
    return {
      ok: true as const,
      summary: result.summary,
      invoice: result.invoice,
      webUrl: `${appOrigin()}/invoices/${id}`,
    };
  },
});
