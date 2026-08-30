import { getInvoice } from "@invoicey/invoice-tools/ops";
import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  buildInvoiceCardModel,
  cardStateFromSummary,
} from "../lib/invoice-card-model";
import { appOrigin } from "../lib/slack-thread";
import { withEveToolWorkspace } from "../lib/tool-workspace";

export default defineTool({
  description:
    "Get one invoice by id. This re-posts its card with the actions available for its current state, so use it when the user wants to act on an invoice from earlier in the conversation.",
  inputSchema: z.object({
    id: z.string().uuid(),
  }),
  async execute({ id }, ctx) {
    return withEveToolWorkspace(ctx, async () => {
      const result = await getInvoice({ id });
      if (!result.ok) return result;
      const webUrl = `${appOrigin()}/invoices/${id}`;
      return {
        ok: true as const,
        summary: result.summary,
        webUrl,
        card: result.invoice
          ? buildInvoiceCardModel({
              invoice: result.invoice,
              invoiceId: id,
              state: cardStateFromSummary(result.summary),
              webUrl,
            })
          : null,
      };
    });
  },
});
