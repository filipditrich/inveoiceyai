import { z } from "zod";

const DraftClientSchema = z
  .object({
    name: z.string().min(1).max(200),
    ico: z.string().optional(),
    dic: z.string().optional(),
    address: z
      .object({
        street: z.string().min(1).max(200),
        city: z.string().min(1).max(100),
        zip: z.string().min(1).max(12),
        country: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .describe("ISO-2, CZ for Czech clients"),
      })
      .describe(
        "Structured address from ARES: { street, city, zip, country }. Never a flat string.",
      ),
    contactEmail: z.string().email().optional(),
  })
  .describe("Buyer/odběratel from ARES lookup. Do not invent IČO or address.");

const DraftMetaSchema = z
  .object({
    docType: z
      .enum(["invoice", "proforma", "advance", "credit_note"])
      .optional(),
    number: z.string().min(1).max(64).optional(),
    issueDate: z.string().date().optional(),
    dueDate: z.string().date().optional(),
    duzp: z.string().date().optional(),
    language: z.enum(["cs", "en"]).optional(),
    currency: z.enum(["CZK", "EUR", "USD"]).optional(),
    correctedInvoiceNumber: z.string().min(1).max(64).optional(),
  })
  .describe(
    "Dates as yyyy-MM-dd. Omit number (server assigns DRAFT-…). Omit issueDate to use today.",
  );

const DraftItemSchema = z.object({
  position: z.number().int().min(1).optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().refine((q) => q !== 0, "quantity must be non-zero"),
  unit: z.string().min(1).max(20).describe("e.g. ks, hod"),
  unitPriceWithoutVat: z
    .number()
    .nonnegative()
    .describe("Exclusive unit price unless pricesIncludeVat is true"),
  vatRate: z
    .number()
    .min(0)
    .max(100)
    .describe("Line VAT % (21/12/0). Does not replace top-level vat."),
});

const DraftPaymentSchema = z
  .object({
    method: z.enum(["transfer", "cash", "card"]),
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
    instructionsBefore: z.string().max(2000).optional(),
    instructionsAfter: z.string().max(2000).optional(),
  })
  .describe(
    "Czech default is transfer. Do not send bankAccount — the locked issuer supplies it.",
  );

const DraftVatSchema = z
  .object({
    mode: z.enum(["regular", "reverse_charge", "oss"]),
    suppliesAbroad: z.enum(["none", "eu", "non_eu"]),
    legalNote: z.string().max(500).optional(),
    localReverseChargeCode: z.string().min(1).max(10).optional(),
  })
  .describe(
    "Required VAT intent. Domestic CZ: { mode: regular, suppliesAbroad: none }. Line vatRate is not a substitute.",
  );

/** Eve tool input: required draft shape so the model cannot call with an empty bag. */
export const CreateInvoiceInputSchema = z.object({
  draft: z.object({
    meta: DraftMetaSchema,
    client: DraftClientSchema,
    vat: DraftVatSchema,
    payment: DraftPaymentSchema,
    items: z.array(DraftItemSchema).min(1),
    pricesIncludeVat: z
      .boolean()
      .optional()
      .describe("True when spoken amounts include VAT"),
    notes: z.string().max(2000).optional(),
  }),
});
