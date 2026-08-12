import {
  OutOfAiTokensError,
  assertHasTokens,
  recordLlmUsage,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  createAndRenderInvoice,
  lookupBusiness,
  searchBusiness,
} from "@invoicey/invoice-tools";
import { resolveDefaultIssuer } from "@invoicey/invoice-tools/ops";
import { runWithInvoiceyContext } from "@invoicey/invoice-tools/workspace-context";
import { gateway } from "@ai-sdk/gateway";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { requireWorkspaceForRoute } from "@/lib/auth/api";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM = `You create Czech invoice drafts for Invoicey.

Issuer is locked server-side — never invent seller fields.

Client / ARES:
- Never invent IČO, DIČ, or address.
- Name only → search_business first; if several matches, pick the best or ask via your final message.
- Known IČO (8 digits) → lookup_business.
- Pass client.address as { street, city, zip, country: "CZ" }.

Draft / VAT (required on create_invoice):
- Include top-level vat: { mode, suppliesAbroad }.
- Domestic default: { mode: "regular", suppliesAbroad: "none" }.
- Each line needs vatRate (e.g. 21). That does not replace vat.
- Include meta, client, payment, items.

Workflow:
1. Resolve client via tools when needed.
2. Call create_invoice with the partial draft.
3. Reply briefly with invoiceId, client name, total, and any issues.

Currency defaults to CZK. Prefer Czech when the user writes Czech.`;

const jsonObjectSchema = z.record(z.string(), z.unknown());

export async function POST(request: Request): Promise<Response> {
  const gate = await requireWorkspaceForRoute(request);
  if ("response" in gate) {
    return gate.response;
  }
  const { workspaceId, userId } = gate.context;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const prompt =
    typeof body === "object" &&
    body !== null &&
    "prompt" in body &&
    typeof (body as { prompt?: unknown }).prompt === "string"
      ? (body as { prompt: string }).prompt.trim()
      : "";

  if (!prompt || prompt.length > 8_000) {
    return Response.json(
      {
        error: "invalid_prompt",
        message: "prompt is required (max 8000 chars)",
      },
      { status: 422 },
    );
  }

  try {
    await assertHasTokens(db, workspaceId);
  } catch (err) {
    if (err instanceof OutOfAiTokensError) {
      return Response.json(
        {
          error: "out_of_ai_tokens",
          message:
            "This workspace has no AI tokens left. Check Settings → Usage.",
        },
        { status: 402 },
      );
    }
    throw err;
  }

  const modelId = process.env.INVOICEY_AI_MODEL?.trim() || "openai/gpt-4o-mini";

  return runWithInvoiceyContext({ workspaceId, userId }, async () => {
    const issuer = await resolveDefaultIssuer({ workspaceId });

    type CreateOk = {
      ok: true;
      invoiceId: string | null;
      invoice: unknown;
      number: string;
      total: number;
      currency: string;
      clientName: string;
    };
    type CreateFail = { ok: false; issues?: unknown; error?: string };
    const lastCreateRef: { current: CreateOk | CreateFail | null } = {
      current: null,
    };

    const result = await generateText({
      model: gateway(modelId),
      instructions: SYSTEM,
      prompt,
      stopWhen: stepCountIs(8),
      tools: {
        lookup_business: tool({
          description:
            "Look up a Czech economic subject by IČO (8 digits) via ARES.",
          inputSchema: z.object({
            ico: z.string().describe("Eight-digit IČO"),
          }),
          execute: async ({ ico }) => lookupBusiness(ico),
        }),
        search_business: tool({
          description:
            "Search Czech economic subjects by company name via ARES.",
          inputSchema: z.object({
            query: z.string(),
            limit: z.number().int().min(1).max(20).optional(),
          }),
          execute: async ({ query, limit }) => searchBusiness(query, { limit }),
        }),
        create_invoice: tool({
          description:
            "Assemble a draft invoice, validate, persist, and render. Issuer is locked server-side.",
          inputSchema: z.object({
            draft: jsonObjectSchema
              .optional()
              .describe(
                "Partial invoice: meta, client, vat, payment, items (issuer ignored).",
              ),
          }),
          execute: async ({ draft }) => {
            const created = await createAndRenderInvoice({
              draft,
              issuer,
            });
            if (!created.ok) {
              const fail: CreateFail =
                "issues" in created
                  ? { ok: false, issues: created.issues }
                  : { ok: false, error: created.error };
              lastCreateRef.current = fail;
              return created;
            }
            const ok: CreateOk = {
              ok: true,
              invoiceId: created.invoiceId ?? null,
              invoice: created.invoice,
              number: created.invoice.meta.number,
              total: created.invoice.totals.total,
              currency: created.invoice.meta.currency,
              clientName: created.invoice.client.name,
            };
            lastCreateRef.current = ok;
            return {
              ok: true as const,
              invoiceId: ok.invoiceId,
              number: ok.number,
              total: ok.total,
              currency: ok.currency,
              clientName: ok.clientName,
              webUrl: ok.invoiceId ? `/invoices/${ok.invoiceId}` : null,
            };
          },
        }),
      },
    });

    const usage = result.totalUsage;
    const promptTokens = usage.inputTokens ?? 0;
    const completionTokens = usage.outputTokens ?? 0;

    const metered = await recordLlmUsage({
      workspaceId,
      userId,
      product: "web",
      model: modelId,
      promptTokens,
      completionTokens,
      metadata: {
        finishReason: result.finishReason,
        steps: result.steps.length,
      },
    });

    const lastCreate = lastCreateRef.current;
    const invoicePayload =
      lastCreate?.ok === true
        ? {
            invoiceId: lastCreate.invoiceId,
            invoice: lastCreate.invoice,
            number: lastCreate.number,
            total: lastCreate.total,
            currency: lastCreate.currency,
            clientName: lastCreate.clientName,
          }
        : null;

    return Response.json({
      ok: true,
      text: result.text,
      invoice: invoicePayload,
      createResult: lastCreate,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        debited: metered.debited,
      },
      balance: metered.summary,
    });
  });
}
