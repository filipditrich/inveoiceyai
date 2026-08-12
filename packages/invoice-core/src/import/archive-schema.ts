import { z } from "zod";

import { InvoiceOriginSchema } from "./origin";

/**
 * Header-only payload for imported invoices without ISDOC.
 * Stored in `payload_json` when `import_completeness = archive`.
 * Downloads must use the stored original PDF — never re-render.
 */
export const ArchiveInvoicePayloadSchema = z.object({
  kind: z.literal("archive"),
  meta: z.object({
    docType: z.enum(["invoice", "proforma", "advance", "credit_note"]),
    number: z.string().min(1).max(64),
    issueDate: z.string().date(),
    dueDate: z.string().date(),
    duzp: z.string().date().optional(),
    currency: z.enum(["CZK", "EUR", "USD"]).default("CZK"),
    language: z.enum(["cs", "en"]).default("cs"),
    correctedInvoiceNumber: z.string().min(1).max(64).optional(),
  }),
  client: z.object({
    name: z.string().min(1).max(200),
    ico: z
      .string()
      .regex(/^\d{8}$/)
      .optional(),
    dic: z.string().max(20).optional(),
    address: z
      .object({
        street: z.string().max(200).optional(),
        city: z.string().max(100).optional(),
        zip: z.string().max(20).optional(),
        country: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .optional(),
      })
      .optional(),
    contactEmail: z.string().email().optional(),
  }),
  totals: z.object({
    subtotal: z.number(),
    vatTotal: z.number(),
    total: z.number(),
  }),
  notes: z.string().max(2000).optional(),
  origin: InvoiceOriginSchema.optional(),
});

export type ArchiveInvoicePayload = z.infer<typeof ArchiveInvoicePayloadSchema>;

export function isArchivePayload(
  value: unknown,
): value is ArchiveInvoicePayload {
  return ArchiveInvoicePayloadSchema.safeParse(value).success;
}
