import { savePreset } from "@invoicey/invoice-tools";
import { defineTool } from "eve/tools";
import { z } from "zod";

import { RealUuidSchema } from "../lib/real-uuid";
import { withEveToolWorkspace } from "../lib/tool-workspace";

export default defineTool({
  description:
    "Create or update a preset (issuer snapshot or invoice_template draft). Omit id to create. Never invent placeholder UUIDs. Do not call when creating an invoice.",
  inputSchema: z.object({
    id: RealUuidSchema.optional().describe(
      "Existing preset id from list_presets; omit to create",
    ),
    kind: z.enum(["issuer", "invoice_template"]),
    name: z.string().min(1).max(120),
    data: z
      .record(z.string(), z.unknown())
      .describe("IssuerSnapshot or partial invoice draft object"),
  }),
  async execute({ id, kind, name, data }, ctx) {
    return withEveToolWorkspace(ctx, () =>
      savePreset({ id, kind, name, data }),
    );
  },
});
