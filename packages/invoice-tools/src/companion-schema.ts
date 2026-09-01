import { z } from "zod";

const jsonObjectSchema = z.record(z.string(), z.any());

const lineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().refine((q) => q !== 0),
  unit: z.string().min(1).max(20).default("ks"),
  unitPriceWithoutVat: z.number().nonnegative(),
  vatRate: z.number().min(0).max(100),
});

export const CompanionCreateDraftSchema = z.object({
  items: z.array(lineSchema).min(1),
  meta: jsonObjectSchema.optional(),
  vat: jsonObjectSchema.optional(),
  vatPreset: z
    .enum(["neplatce", "regular", "reverse_charge", "oss"])
    .optional(),
  payment: jsonObjectSchema.optional(),
  pricesIncludeVat: z.boolean().optional(),
});

export const CompanionRequestSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("me") }),
  z.object({ op: z.literal("status") }),
  z.object({
    op: z.literal("invoices.list"),
    limit: z.number().int().min(1).max(100).optional(),
    unpaidOnly: z.boolean().optional(),
    q: z.string().max(80).optional(),
  }),
  z.object({ op: z.literal("invoices.get"), ref: z.string().min(1).max(80) }),
  z.object({
    op: z.literal("invoices.create"),
    clientId: z.string().uuid().optional(),
    ico: z.string().optional(),
    draft: CompanionCreateDraftSchema,
  }),
  z.object({ op: z.literal("invoices.issue"), ref: z.string().min(1).max(80) }),
  z.object({
    op: z.literal("invoices.send"),
    ref: z.string().min(1).max(80),
    to: z.string().email().optional(),
    cc: z.array(z.string().email()).optional(),
    coverText: z.string().optional(),
    subject: z.string().optional(),
    attachIsdoc: z.boolean().optional(),
  }),
  z.object({ op: z.literal("invoices.paid"), ref: z.string().min(1).max(80) }),
  z.object({
    op: z.literal("invoices.unpaid"),
    ref: z.string().min(1).max(80),
  }),
  z.object({
    op: z.literal("invoices.cancel"),
    ref: z.string().min(1).max(80),
  }),
  z.object({ op: z.literal("clients.list") }),
  z.object({ op: z.literal("clients.add"), ico: z.string().min(1).max(16) }),
  z.object({ op: z.literal("issuers.list") }),
  z.object({ op: z.literal("payments.proposals") }),
  z.object({
    op: z.literal("payments.confirm"),
    proposalId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("payments.reject"),
    proposalId: z.string().uuid(),
  }),
  z.object({ op: z.literal("ares.lookup"), ico: z.string().min(1).max(16) }),
  z.object({
    op: z.literal("ares.search"),
    query: z.string().min(1).max(120),
    limit: z.number().int().min(1).max(20).optional(),
  }),
]);

export type CompanionRequest = z.infer<typeof CompanionRequestSchema>;
export type CompanionCreateDraft = z.infer<typeof CompanionCreateDraftSchema>;
