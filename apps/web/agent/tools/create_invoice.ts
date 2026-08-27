import { createAndRenderInvoice } from "@invoicey/invoice-tools";
import { resolveDefaultIssuer } from "@invoicey/invoice-tools/ops";
import { defineTool } from "eve/tools";

import { CreateInvoiceInputSchema } from "../lib/create-invoice-input";
import { buildInvoiceCardModel } from "../lib/invoice-card-model";
import { appOrigin } from "../lib/slack-thread";
import { withEveToolWorkspace } from "../lib/tool-workspace";

export default defineTool({
  description:
    "Assemble a draft invoice, persist it, and post a review card in Slack with every field visible — including anything that had to be assumed. Issuer is locked server-side (do not pass issuer, issuerPresetId, or templatePresetId — those fields do not exist). Nothing is issued or e-mailed here: the user reviews the card and issues it from the button. Call only with draft: meta, client (structured address from ARES), vat, payment.method, and items.",
  inputSchema: CreateInvoiceInputSchema,
  async execute({ draft }, ctx) {
    return withEveToolWorkspace(ctx, async () => {
      const issuer = await resolveDefaultIssuer();
      if (!issuer) {
        return {
          ok: false as const,
          error:
            "no issuer in this workspace — create one in Invoicey before drafting",
        };
      }
      const result = await createAndRenderInvoice({
        draft,
        issuer,
      });
      if (!result.ok) return result;

      const webUrl = result.invoiceId
        ? `${appOrigin()}/invoices/${result.invoiceId}`
        : null;

      /**
       * The PDF is deliberately not uploaded here. A draft is a proposal, and
       * uploading two files per revision buries the thread; the review card
       * carries a `Preview PDF` button for when the user actually wants it.
       */
      return {
        ok: true as const,
        invoiceId: result.invoiceId ?? null,
        number: result.invoice.meta.number,
        total: String(result.invoice.totals.total),
        currency: result.invoice.meta.currency,
        clientName: result.invoice.client.name,
        assumptions: result.assumptions,
        webUrl,
        card: buildInvoiceCardModel({
          invoice: result.invoice,
          invoiceId: result.invoiceId ?? null,
          state: "draft",
          assumptions: result.assumptions,
          webUrl,
        }),
      };
    });
  },
});
