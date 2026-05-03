import { fetchAresEkonomickySubjekt } from "@invoicey/ares";
import {
  calcTotals,
  renderInvoicePdf,
  renderIsdoc,
} from "@invoicey/invoice-core";
import {
  InvoiceSchema,
  type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";
import { tool } from "ai";
import { z } from "zod";

import {
  addCalendarDaysYmd,
  normalizeDraftToInvoice,
} from "./normalize-draft-invoice";
import { parseAmountCz } from "./parse-amount-cz";

const vatInputSchema = z.object({
  mode: z.enum(["regular", "reverse_charge", "oss"]),
  suppliesAbroad: z.enum(["none", "eu", "non_eu"]),
  legalNote: z.string().max(500).optional(),
});

const lineInputSchema = z.object({
  position: z.number().int().min(1),
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unitPriceWithoutVat: z.number(),
  vatRate: z.number(),
});

/**
 * Tool surface for the Slack invoice agent (portable to MCP in Plan 12).
 * Issuer is injected server-side; the model cannot override bank / identity for the "from" party.
 */
export function createInvoiceSlackTools(issuer: IssuerSnapshot) {
  return {
    lookup_business: tool({
      description:
        "Look up a Czech economic subject by IČO (8 digits) via ARES public REST. Returns draft client fields (no `id`). Caller must put `id` (UUID) on the client in the invoice draft.",
      inputSchema: z.object({
        ico: z.string().describe("Eight-digit IČO"),
      }),
      execute: async ({ ico }) => {
        const r = await fetchAresEkonomickySubjekt(ico);
        if (!r.ok) {
          return {
            ok: false as const,
            kind: r.kind,
            message: r.message,
          };
        }
        return { ok: true as const, draft: r.draft };
      },
    }),

    parse_amount_cz: tool({
      description:
        'Parse a Czech money string into CZK major units, e.g. "50 000 Kč", "1.000,50".',
      inputSchema: z.object({ input: z.string() }),
      execute: async ({ input }) => parseAmountCz(input),
    }),

    compute_due_date: tool({
      description:
        "Compute due date as issueDate plus N calendar days (default 14). Dates are YYYY-MM-DD.",
      inputSchema: z.object({
        issueDate: z.string(),
        daysFromIssue: z.number().int().min(1).max(366).optional(),
      }),
      execute: async ({ issueDate, daysFromIssue }) => ({
        dueDate: addCalendarDaysYmd(issueDate, daysFromIssue ?? 14),
      }),
    }),

    compute_totals: tool({
      description:
        "Compute line subtotals, VAT, and invoice totals from raw line inputs and VAT mode. Uses the same rules as the web app.",
      inputSchema: z.object({
        items: z.array(lineInputSchema),
        vat: vatInputSchema,
        issuerVatPayer: z.boolean(),
      }),
      execute: async ({ items, vat, issuerVatPayer }) =>
        calcTotals(items, vat, issuerVatPayer),
    }),

    assemble_and_validate: tool({
      description:
        "Merge draft invoice fields with the fixed demo issuer, recompute totals from line unit prices, and validate against InvoiceSchema. Call again after fixing `issues` paths.",
      inputSchema: z.object({
        draft: z
          .unknown()
          .describe(
            "Object with meta, client, vat, payment, items; issuer is ignored and replaced server-side.",
          ),
      }),
      execute: async ({ draft }) => normalizeDraftToInvoice(draft, issuer),
    }),

    render_pdf: tool({
      description:
        "Render a validated invoice to PDF bytes (base64). Only call after assemble_and_validate returned ok:true.",
      inputSchema: z.object({ invoice: z.unknown() }),
      execute: async ({ invoice }) => {
        const p = InvoiceSchema.safeParse(invoice);
        if (!p.success) {
          return { ok: false as const, error: "invoice validation failed" };
        }
        const pdfBytes = await renderInvoicePdf(p.data);
        const safeName = p.data.meta.number.replace(/[^\w.-]+/g, "_");
        return {
          ok: true as const,
          base64: Buffer.from(pdfBytes).toString("base64"),
          filename: `faktura-${safeName}.pdf`,
        };
      },
    }),

    render_isdoc: tool({
      description:
        "Render ISDOC 6.0.2 XML for a validated invoice. Only call after assemble_and_validate returned ok:true.",
      inputSchema: z.object({ invoice: z.unknown() }),
      execute: async ({ invoice }) => {
        const p = InvoiceSchema.safeParse(invoice);
        if (!p.success) {
          return { ok: false as const, error: "invoice validation failed" };
        }
        const xml = renderIsdoc(p.data);
        const safeName = p.data.meta.number.replace(/[^\w.-]+/g, "_");
        return {
          ok: true as const,
          xml,
          filename: `faktura-${safeName}.isdoc.xml`,
        };
      },
    }),
  };
}

export type InvoiceSlackTools = ReturnType<typeof createInvoiceSlackTools>;
