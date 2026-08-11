import { markInvoicePaidById } from "@invoicey/invoice-tools/ops";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { withEveToolWorkspace } from "../lib/tool-workspace";

export default defineTool({
  description: "Mark an issued invoice as paid. Requires Slack approval.",
  inputSchema: z.object({
    id: z.string().uuid(),
  }),
  approval: always(),
  async execute({ id }, ctx) {
    return withEveToolWorkspace(ctx, () => markInvoicePaidById({ id }));
  },
});
