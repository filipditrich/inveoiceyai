import { savePreset } from "@invoicey/invoice-tools";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Create or update a preset (issuer snapshot or invoice_template draft).",
  inputSchema: z.object({
    id: z.string().uuid().optional().describe("Omit to create a new preset"),
    kind: z.enum(["issuer", "invoice_template"]),
    name: z.string().min(1).max(120),
    data: z
      .record(z.string(), z.unknown())
      .describe("IssuerSnapshot or partial invoice draft object"),
  }),
  async execute({ id, kind, name, data }) {
    return savePreset({ id, kind, name, data });
  },
});
