import { createGateway, type GatewayModelId } from "@ai-sdk/gateway";
import { generateText, stepCountIs } from "ai";
import { renderInvoicePdf, renderIsdoc } from "@invoicey/invoice-core";
import {
  InvoiceSchema,
  type Invoice,
  type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";

import { createInvoiceSlackTools } from "./ai-tools";

function buildSystemPrompt(issuer: IssuerSnapshot): string {
  return `You are a Czech invoicing assistant for a single demo issuer.

Hard rules:
- Currency is always CZK. Invoice language is always cs. Dates are YYYY-MM-DD.
- Default docType is "invoice". Use "proforma" or "advance" only if the user clearly asks.
- Default issue date is today in Europe/Prague unless the user specifies otherwise.
- Default due date is issue date + 14 days unless specified.
- Default VAT mode is "regular" and suppliesAbroad "none" unless the user indicates reverse charge, OSS, or foreign supply.
- Default payment method is "transfer". For "transfer", do not invent bankAccount — assemble_and_validate fills it from the locked issuer.
- If the user gives an 8-digit IČO for the client, call lookup_business first and use the returned draft for client fields; then set client.id to a new random UUID string before assemble_and_validate.
- If only a company name is given (no IČO), build client with a new UUID id and plausible CZ address only if needed for a demo; prefer including IČO when possible.
- Never change the issuer; never invent issuer IČO, DIČ, IBAN, or bank details.
- Use parse_amount_cz for human-written amounts.
- Use compute_totals if you want to preview totals; final numbers must come from assemble_and_validate.
- After assemble_and_validate returns ok:true, call render_pdf and then render_isdoc with the same invoice object.

Locked issuer (JSON):
${JSON.stringify(issuer)}`;
}

export interface NormalizedIssue {
  path: string;
  message: string;
}

export type RunAiInvoiceResult =
  | { ok: true; invoice: Invoice; pdfBytes: Uint8Array; isdocXml: string }
  | {
      ok: false;
      message: string;
      issues?: NormalizedIssue[];
    };

function collectFromSteps(
  steps: Array<{
    toolResults: ReadonlyArray<{ toolName: string; output: unknown }>;
  }>,
): {
  invoice?: Invoice;
  pdfBase64?: string;
  isdocXml?: string;
  lastIssues?: NormalizedIssue[];
} {
  let invoice: Invoice | undefined;
  let pdfBase64: string | undefined;
  let isdocXml: string | undefined;
  let lastIssues: NormalizedIssue[] | undefined;

  for (const step of steps) {
    for (const tr of step.toolResults) {
      const { toolName, output } = tr;
      if (
        toolName === "assemble_and_validate" &&
        output &&
        typeof output === "object"
      ) {
        const o = output as {
          ok: boolean;
          invoice?: Invoice;
          issues?: NormalizedIssue[];
        };
        if (o.ok && o.invoice) {
          const checked = InvoiceSchema.safeParse(o.invoice);
          if (checked.success) {
            invoice = checked.data;
          }
        } else if (!o.ok && Array.isArray(o.issues)) {
          lastIssues = o.issues;
        }
      }
      if (
        toolName === "render_pdf" &&
        output &&
        typeof output === "object" &&
        "ok" in output &&
        (output as { ok: boolean }).ok
      ) {
        pdfBase64 = (output as unknown as { base64: string }).base64;
      }
      if (
        toolName === "render_isdoc" &&
        output &&
        typeof output === "object" &&
        "ok" in output &&
        (output as { ok: boolean }).ok
      ) {
        isdocXml = (output as unknown as { xml: string }).xml;
      }
    }
  }

  return { invoice, pdfBase64, isdocXml, lastIssues };
}

export async function runAiInvoiceGeneration(options: {
  userText: string;
  issuer: IssuerSnapshot;
  apiKey: string;
  primaryModel: string;
  fallbackModel?: string;
}): Promise<RunAiInvoiceResult> {
  const { userText, issuer, apiKey, primaryModel, fallbackModel } = options;

  const tools = createInvoiceSlackTools(issuer);

  const runWithModel = (modelId: string) => {
    const gw = createGateway({ apiKey });
    const model = gw.languageModel(modelId as GatewayModelId);
    return generateText({
      model,
      tools,
      stopWhen: stepCountIs(16),
      system: buildSystemPrompt(issuer),
      prompt: `User message:\n${userText}`,
    });
  };

  const finish = async (
    result: Awaited<ReturnType<typeof runWithModel>>,
  ): Promise<RunAiInvoiceResult> => {
    const { invoice, pdfBase64, isdocXml, lastIssues } = collectFromSteps(
      result.steps,
    );

    if (!invoice) {
      const hint = lastIssues?.length
        ? lastIssues.map((i) => `• ${i.path}: ${i.message}`).join("\n")
        : "Zkus doplnit IČO klienta, částku a stručný popis položky.";
      return {
        ok: false,
        message: `Nepodařilo se sestavit platnou fakturu.\n${hint}`,
        issues: lastIssues,
      };
    }

    let pdfBytes: Uint8Array;
    if (pdfBase64) {
      pdfBytes = new Uint8Array(Buffer.from(pdfBase64, "base64"));
    } else {
      pdfBytes = await renderInvoicePdf(invoice);
    }

    const xml = isdocXml ?? renderIsdoc(invoice);

    return { ok: true, invoice, pdfBytes, isdocXml: xml };
  };

  try {
    const result = await runWithModel(primaryModel);
    return await finish(result);
  } catch (primaryErr) {
    if (fallbackModel && fallbackModel !== primaryModel) {
      try {
        const result = await runWithModel(fallbackModel);
        return await finish(result);
      } catch (fallbackErr) {
        const msg =
          fallbackErr instanceof Error
            ? fallbackErr.message
            : String(fallbackErr);
        return { ok: false, message: `AI error: ${msg}` };
      }
    }
    const msg =
      primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    return { ok: false, message: `AI error: ${msg}` };
  }
}
