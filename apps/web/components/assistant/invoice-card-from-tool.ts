import type { InvoiceCardModel } from "@/agent/lib/invoice-card-model";
import type { EveDynamicToolPart } from "eve/react";

/**
 * Pulls the review card out of a tool result.
 *
 * `create_invoice`, `update_invoice_draft`, `issue_invoice` and friends all
 * return a `card` built by `buildInvoiceCardModel` — the same serializable
 * model the Slack channel turns into Block Kit. The panel renders it as a React
 * card, so both surfaces show the same fields and the same `assumed` tags
 * without either one re-deriving them from the invoice.
 *
 * The shape is checked rather than assumed. A thread restored from
 * `localStorage` replays whatever the tool returned when the turn ran, which
 * after a deploy that changed the model can be a card from the previous shape;
 * rejecting it here renders that step as a plain tool row instead of crashing
 * the panel.
 */
export function invoiceCardFromToolPart(
  part: EveDynamicToolPart,
): InvoiceCardModel | null {
  if (part.state !== "output-available") return null;
  return invoiceCardFromOutput(part.output);
}

export function invoiceCardFromOutput(
  output: unknown,
): InvoiceCardModel | null {
  if (!output || typeof output !== "object") return null;
  const card = (output as { card?: unknown }).card;
  if (!card || typeof card !== "object") return null;

  const candidate = card as Partial<InvoiceCardModel>;
  if (candidate.kind !== "invoice") return null;
  if (!Array.isArray(candidate.fields)) return null;
  /** Present only on the current model; their absence marks a stale card. */
  if (!Array.isArray(candidate.notice)) return null;
  if (!Array.isArray(candidate.assumedPaths)) return null;
  if (candidate.locale !== "cs" && candidate.locale !== "en") return null;

  return candidate as InvoiceCardModel;
}
