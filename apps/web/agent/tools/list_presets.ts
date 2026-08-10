import { listPresets } from "@invoicey/invoice-tools";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "List saved issuer and invoice_template presets (Neon when DATABASE_URL is set).",
  inputSchema: z.object({
    kind: z
      .enum(["issuer", "invoice_template"])
      .optional()
      .describe("Optional filter"),
  }),
  async execute({ kind }) {
    return listPresets({ kind });
  },
});
