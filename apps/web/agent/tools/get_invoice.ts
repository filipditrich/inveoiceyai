import { getInvoice } from "@invoicey/invoice-tools/ops";
import { defineTool } from "eve/tools";
import { z } from "zod";

import { appOrigin } from "../lib/slack-thread";
import { withEveToolWorkspace } from "../lib/tool-workspace";

export default defineTool({
  description: "Get one invoice by id (summary + payload when available).",
  inputSchema: z.object({
    id: z.string().uuid(),
  }),
  async execute({ id }, ctx) {
    return withEveToolWorkspace(ctx, async () => {
      const result = await getInvoice({ id });
      if (!result.ok) return result;
      return {
        ok: true as const,
        summary: result.summary,
        invoice: result.invoice,
        webUrl: `${appOrigin()}/invoices/${id}`,
      };
    });
  },
});
