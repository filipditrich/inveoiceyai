import { z } from "zod";
export const SummarySchema = z.object({
  id: z.string(),
  number: z.string().nullable(),
  clientName: z.string(),
  total: z.string(),
  currency: z.string(),
  issueDate: z.string(),
  dueDate: z.string(),
  status: z.string(),
  displayStatus: z.string(),
  issuedAt: z.string().nullable().optional(),
});
const PartySchema = z.object({
  name: z.string(),
  contactEmail: z.string().optional(),
  ico: z.string().optional(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    zip: z.string(),
    country: z.string(),
  }),
});
export const InvoiceSchema = z.object({
  meta: z.object({
    number: z.string(),
    issueDate: z.string(),
    dueDate: z.string(),
    currency: z.string(),
  }),
  issuer: PartySchema,
  client: PartySchema,
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unit: z.string(),
      unitPriceWithoutVat: z.number(),
      lineTotal: z.number(),
      vatRate: z.number(),
    }),
  ),
  totals: z.object({
    subtotal: z.number(),
    vatTotal: z.number(),
    total: z.number(),
  }),
  notes: z.string().optional(),
});
export const PayloadSchema = z.object({
  ok: z.boolean().optional(),
  error: z.string().optional(),
  invoices: z.array(SummarySchema).optional(),
  nextOffset: z.number().nullable().optional(),
  summary: SummarySchema.optional(),
  invoice: InvoiceSchema.nullable().optional(),
  invoiceId: z.string().optional(),
  pdfUrl: z.string().nullable().optional(),
  isdocUrl: z.string().nullable().optional(),
  assumptions: z
    .array(
      z
        .object({
          path: z.string(),
          label: z.string(),
          value: z.string(),
          reason: z.string(),
        })
        .passthrough(),
    )
    .optional(),
});
export type Summary = z.infer<typeof SummarySchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type Payload = z.infer<typeof PayloadSchema>;
