import { listPresets } from "@invoicey/invoice-tools";
import { defineTool } from "eve/tools";
import { z } from "zod";

import { withEveToolWorkspace } from "../lib/tool-workspace";

export default defineTool({
  description:
    "List saved issuer and invoice_template presets. Do not call this when creating or issuing an invoice — the seller is injected server-side. Use only if the user explicitly asks to inspect presets.",
  inputSchema: z.object({
    kind: z
      .enum(["issuer", "invoice_template"])
      .optional()
      .describe("Optional filter"),
  }),
  async execute({ kind }, ctx) {
    return withEveToolWorkspace(ctx, () => listPresets({ kind }));
  },
});
