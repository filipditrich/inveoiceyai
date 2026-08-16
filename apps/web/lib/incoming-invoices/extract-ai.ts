import { gateway } from "@ai-sdk/gateway";
import {
  OutOfAiTokensError,
  assertHasTokens,
  recordLlmUsage,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";
import { generateObject } from "ai";
import { z } from "zod";

const Confidence = z.enum(["high", "medium", "low"]);

const ExtractedSchema = z.object({
  supplierName: z.string().nullable(),
  supplierIco: z.string().nullable(),
  supplierDic: z.string().nullable(),
  number: z.string().nullable(),
  issueDate: z.string().nullable(),
  taxDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  currency: z.string().nullable(),
  subtotal: z.string().nullable(),
  vatTotal: z.string().nullable(),
  total: z.string().nullable(),
  variableSymbol: z.string().nullable(),
  iban: z.string().nullable(),
  accountNumber: z.string().nullable(),
  bankCode: z.string().nullable(),
  confidence: z.object({
    supplierName: Confidence,
    supplierIco: Confidence,
    number: Confidence,
    issueDate: Confidence,
    dueDate: Confidence,
    currency: Confidence,
    total: Confidence,
    iban: Confidence,
  }),
});

export type AiExtraction = z.infer<typeof ExtractedSchema>;

export async function extractIncomingInvoiceWithAi(input: {
  workspaceId: string;
  userId?: string;
  pdfBytes: Uint8Array;
  fileName: string;
}): Promise<
  | { ok: true; data: AiExtraction; model: string }
  | { ok: false; skipped: true; reason: "out_of_tokens" | "no_gateway" }
> {
  const modelId =
    env.INVOICEY_AI_EXTRACT_MODEL ??
    process.env.INVOICEY_AI_MODEL ??
    "openai/gpt-4o-mini";
  if (!process.env.AI_GATEWAY_API_KEY) {
    return { ok: false, skipped: true, reason: "no_gateway" };
  }
  try {
    await assertHasTokens(db, input.workspaceId);
  } catch (error) {
    if (error instanceof OutOfAiTokensError) {
      return { ok: false, skipped: true, reason: "out_of_tokens" };
    }
    throw error;
  }

  const result = await generateObject({
    model: gateway(modelId),
    schema: ExtractedSchema,
    system:
      "Extract fields from a supplier invoice. Never invent IČO, account numbers, or dates. If unreadable, return null for that field and low confidence.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract the invoice header from ${input.fileName}.`,
          },
          {
            type: "file",
            data: input.pdfBytes,
            mediaType: "application/pdf",
          },
        ],
      },
    ],
  });

  await recordLlmUsage({
    workspaceId: input.workspaceId,
    userId: input.userId,
    product: "incoming_invoice_extract",
    model: modelId,
    promptTokens: result.usage?.inputTokens ?? 0,
    completionTokens: result.usage?.outputTokens ?? 0,
  });

  return { ok: true, data: result.object, model: modelId };
}
