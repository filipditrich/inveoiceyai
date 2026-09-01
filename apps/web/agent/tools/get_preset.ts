import { defineTool } from "eve/tools";
import { z } from "zod";

import { getPreset } from "@invoicey/invoice-tools";

import { RealUuidSchema } from "../lib/real-uuid";
import { withEveToolWorkspace } from "../lib/tool-workspace";

export default defineTool({
  description:
    "Get one preset by id returned from list_presets. Never invent or guess UUIDs (including 0000… and ffff…). Do not call when creating an invoice.",
  inputSchema: z.object({
    id: RealUuidSchema,
  }),
  async execute({ id }, ctx) {
    return withEveToolWorkspace(ctx, () => getPreset({ id }));
  },
});
