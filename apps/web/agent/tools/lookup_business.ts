import { defineTool } from "eve/tools";
import { z } from "zod";

import { lookupBusiness } from "@invoicey/invoice-tools";

import { withEveToolWorkspace } from "../lib/tool-workspace";

export default defineTool({
  description:
    "Look up a Czech economic subject by IČO (8 digits) via ARES. Returns draft client fields including structured address {street,city,zip,country}. Prefer after search_business or when IČO is known. Never invent address fields.",
  inputSchema: z.object({
    ico: z.string().describe("Eight-digit Czech IČO"),
  }),
  async execute({ ico }, ctx) {
    return withEveToolWorkspace(ctx, () => lookupBusiness(ico));
  },
});
