import { listInvoices } from "@invoicey/invoice-tools/ops";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "List invoices in the default workspace. Use unpaidOnly for issued-but-unpaid.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    unpaidOnly: z.boolean().optional(),
  }),
  async execute({ limit, unpaidOnly }) {
    const invoices = await listInvoices({ limit, unpaidOnly });
    return { ok: true as const, invoices };
  },
});
