import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { markInvoicePaidById } from "@invoicey/invoice-tools/ops";

import { withEveToolWorkspace } from "../lib/tool-workspace";

export default defineTool({
  description:
    "Mark an issued invoice as paid. Requires Allow/Deny approval. Pass `confirm` with the invoice number and total exactly as shown on the card — the approval prompt renders the tool input verbatim, so without it the reviewer is approving a bare id.",
  inputSchema: z.object({
    id: z.string().uuid(),
    confirm: z
      .object({
        number: z.string().min(1).describe("Invoice number as shown"),
        total: z.string().min(1).describe("Total with currency"),
      })
      .describe(
        "Shown to the human on the approval card. Copy, do not invent.",
      ),
  }),
  approval: always(),
  async execute({ id }, ctx) {
    return withEveToolWorkspace(ctx, () => markInvoicePaidById({ id }));
  },
});
