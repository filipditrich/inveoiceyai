import { getPreset } from "@invoicey/invoice-tools";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Get one preset by id.",
  inputSchema: z.object({
    id: z.string().uuid(),
  }),
  async execute({ id }) {
    return getPreset({ id });
  },
});
