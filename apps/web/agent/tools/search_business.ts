import { defineTool } from "eve/tools";
import { z } from "zod";

import { searchBusiness } from "@invoicey/invoice-tools";

import { withEveToolWorkspace } from "../lib/tool-workspace";

export default defineTool({
  description:
    "Search Czech economic subjects by company name via ARES. Use when the user gives a name without IČO. Returns matches with IČO and structured address; then call lookup_business with the chosen IČO (or use match.address directly if present). Never invent an address.",
  inputSchema: z.object({
    query: z.string().describe("Company name fragment, e.g. NFCtron a.s."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("Max matches (default 5)"),
  }),
  async execute({ query, limit }, ctx) {
    return withEveToolWorkspace(ctx, () => searchBusiness(query, { limit }));
  },
});
