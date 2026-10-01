import { z } from "zod";

import {
  ClientSnapshotSchema,
  InvoiceVatSchema,
  InvoiceItemSchema,
} from "@invoicey/invoice-core/schema";

const MetaDraftSchema = z.object({
  docType: z.enum(["invoice", "proforma", "advance", "credit_note"]),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  duzp: z.string().date(),
  currency: z.enum(["CZK", "EUR", "USD"]),
  language: z.enum(["cs", "en"]),
  correctedInvoiceNumber: z.string().min(1).max(64).optional(),
});
const ClientDraftSchema = ClientSnapshotSchema.omit({ id: true });
const PaymentDraftSchema = z.object({
  method: z.enum(["transfer", "cash", "card", "offset"]),
  variableSymbol: z
    .string()
    .regex(/^\d{1,10}$/)
    .optional(),
  constantSymbol: z
    .string()
    .regex(/^\d{1,4}$/)
    .optional(),
  specificSymbol: z
    .string()
    .regex(/^\d{1,10}$/)
    .optional(),
});

export const McpDraftSchema = z
  .object({
    meta: MetaDraftSchema,
    client: ClientDraftSchema,
    payment: PaymentDraftSchema,
    vat: InvoiceVatSchema.optional(),
    vatPreset: z
      .enum(["neplatce", "regular", "reverse_charge", "oss"])
      .optional(),
    items: z
      .array(
        InvoiceItemSchema.omit({
          position: true,
          lineSubtotal: true,
          lineVat: true,
          lineTotal: true,
        }),
      )
      .min(1)
      .max(200),
    pricesIncludeVat: z.boolean().optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const McpDraftPatchSchema = McpDraftSchema.partial()
  .extend({
    meta: MetaDraftSchema.partial().optional(),
    client: ClientDraftSchema.partial().optional(),
    payment: PaymentDraftSchema.partial().optional(),
  })
  .strict();
