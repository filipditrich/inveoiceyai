import { defineTool } from "eve/tools";
import { z } from "zod";

import { updateDraftInvoice } from "@invoicey/invoice-tools";

import { buildInvoiceCardModel } from "../lib/invoice-card-model";
import { appOrigin } from "../lib/slack-thread";
import { withEveToolWorkspace } from "../lib/tool-workspace";

const AddressSchema = z.object({
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  zip: z.string().min(1).max(12),
  country: z.string().regex(/^[A-Z]{2}$/),
});

const ItemSchema = z.object({
  position: z.number().int().min(1).optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().refine((q) => q !== 0, "quantity must be non-zero"),
  unit: z.string().min(1).max(20),
  unitPriceWithoutVat: z.number().nonnegative(),
  vatRate: z.number().min(0).max(100),
});

export default defineTool({
  description:
    "Change a draft invoice that already exists and re-post its review card. Use this whenever the user corrects something about a draft you just made — dates, currency, VAT treatment, language, payment method, notes, the client, or the line items — instead of creating a second draft. Totals are recomputed. Only fields you pass are changed; `items` replaces the whole list. Issued invoices are immutable and are rejected.",
  inputSchema: z.object({
    id: z.string().uuid().describe("Draft invoice id"),
    meta: z
      .object({
        issueDate: z.string().date().optional(),
        dueDate: z.string().date().optional(),
        duzp: z.string().date().optional(),
        currency: z.enum(["CZK", "EUR", "USD"]).optional(),
        language: z.enum(["cs", "en"]).optional(),
        docType: z
          .enum(["invoice", "proforma", "advance", "credit_note"])
          .optional(),
      })
      .optional(),
    vat: z
      .object({
        mode: z.enum(["regular", "reverse_charge", "oss"]),
        suppliesAbroad: z.enum(["none", "eu", "non_eu"]),
      })
      .optional()
      .describe("Pass both fields together — VAT intent is not partial."),
    payment: z
      .object({
        method: z.enum(["transfer", "cash", "card"]).optional(),
        variableSymbol: z
          .string()
          .regex(/^\d{1,10}$/)
          .optional(),
      })
      .optional(),
    client: z
      .object({
        name: z.string().min(1).max(200),
        ico: z.string().optional(),
        dic: z.string().optional(),
        address: AddressSchema,
        contactEmail: z.string().email().optional(),
      })
      .optional()
      .describe("Full replacement from ARES. Never invent IČO or address."),
    items: z
      .array(ItemSchema)
      .min(1)
      .optional()
      .describe("Replaces every line. Send the complete list, not a delta."),
    pricesIncludeVat: z
      .boolean()
      .optional()
      .describe(
        "Set true to reinterpret the current line prices as VAT-inclusive.",
      ),
    notes: z.string().max(2000).optional(),
  }),
  async execute({ id, ...patch }, ctx) {
    return withEveToolWorkspace(ctx, async () => {
      const cleaned = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      );
      if (Object.keys(cleaned).length === 0) {
        return {
          ok: false as const,
          error: "nothing to change — pass at least one field",
        };
      }
      const result = await updateDraftInvoice({ id, patch: cleaned });
      if (!result.ok) return result;

      const webUrl = `${appOrigin()}/invoices/${id}`;
      return {
        ok: true as const,
        invoiceId: id,
        number: result.invoice.meta.number,
        total: String(result.invoice.totals.total),
        currency: result.invoice.meta.currency,
        clientName: result.invoice.client.name,
        changed: Object.keys(cleaned),
        webUrl,
        card: buildInvoiceCardModel({
          invoice: result.invoice,
          invoiceId: id,
          state: "draft",
          assumptions: result.assumptions,
          webUrl,
        }),
      };
    });
  },
});
