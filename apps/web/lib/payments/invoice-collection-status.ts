import { z } from "zod";

export const InvoiceCollectionStatusSchema = z.object({
  paymentState: z.enum(["unpaid", "partial", "paid", "overpaid"]),
  paidAmount: z.string(),
  outstandingAmount: z.string(),
  settled: z.boolean(),
  polled: z.boolean(),
  retryAfterMs: z.number().nonnegative(),
  refreshError: z.string().optional(),
});

export type InvoiceCollectionStatus = z.infer<
  typeof InvoiceCollectionStatusSchema
>;
