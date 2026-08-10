import { lookupBusiness } from "@invoicey/invoice-tools";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Look up a Czech economic subject by IČO (8 digits) via ARES. Returns draft client fields (no id).",
  inputSchema: z.object({
    ico: z.string().describe("Eight-digit Czech IČO"),
  }),
  async execute({ ico }) {
    return lookupBusiness(ico);
  },
});
