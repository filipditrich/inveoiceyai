import { z } from "zod";

const paymentAmount = z
  .string()
  .regex(/^\d{1,16}(?:\.\d{1,2})?$/u)
  .refine((value) => Number(value) > 0, "amount must be positive");
const requestId = z.string().uuid();

export const PocketRequestSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("me") }),
  z.object({
    op: z.literal("payment_requests.create"),
    amount: paymentAmount,
    message: z.string().trim().max(60).optional(),
  }),
  z.object({
    op: z.literal("payment_requests.list"),
    limit: z.number().int().min(1).max(100).default(30),
  }),
  z.object({ op: z.literal("payment_requests.get"), requestId }),
  z.object({ op: z.literal("payment_requests.watch"), requestId }),
  z.object({
    op: z.literal("invoices.list_unpaid"),
    limit: z.number().int().min(1).max(100).default(30),
  }),
  z.object({ op: z.literal("invoices.collect"), invoiceId: z.string().uuid() }),
  z.object({ op: z.literal("invoices.watch"), invoiceId: z.string().uuid() }),
  z.object({
    op: z.literal("device.register_push"),
    token: z.string().regex(/^[a-fA-F0-9]{64}$/u),
    environment: z.enum(["sandbox", "production"]),
  }),
  z.object({
    op: z.literal("notifications.list"),
    limit: z.number().int().min(1).max(100).default(30),
  }),
  z.object({
    op: z.literal("notifications.read"),
    notificationId: z.string().uuid(),
  }),
]);

export type PocketRequest = z.infer<typeof PocketRequestSchema>;
