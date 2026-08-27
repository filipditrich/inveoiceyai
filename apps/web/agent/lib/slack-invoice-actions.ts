/**
 * Action-id vocabulary for Invoicey's own Slack card controls.
 *
 * Eve owns the `eve_input:` / `eve_input_freeform:` prefixes for its HITL
 * widgets and forwards everything else to `onInteraction`, so every id here
 * carries a distinct namespace. Select widgets report only
 * `selected_option.value` (never the block's `value`), so the invoice id has
 * to ride inside the option value — hence {@link encodeSelectValue}.
 */
export const INVOICEY_ACTION_PREFIX = "invoicey:";

export const INVOICEY_ACTIONS = {
  /**
   * The "open in the web app" link button. Slack still posts a `block_actions`
   * payload for URL buttons, so this id exists purely to be recognised and
   * ignored — without it the click falls through to the generic
   * "missing invoice reference" path.
   */
  openWeb: "invoicey:open_web",
  issue: "invoicey:issue",
  previewPdf: "invoicey:preview_pdf",
  discard: "invoicey:discard",
  markPaid: "invoicey:mark_paid",
  sendEmail: "invoicey:send_email",
  setDue: "invoicey:set_due",
  setCurrency: "invoicey:set_currency",
  setVat: "invoicey:set_vat",
  setLanguage: "invoicey:set_language",
} as const;

export type InvoiceyActionId =
  (typeof INVOICEY_ACTIONS)[keyof typeof INVOICEY_ACTIONS];

export function isInvoiceyAction(actionId: string): boolean {
  return actionId.startsWith(INVOICEY_ACTION_PREFIX);
}

/** `<uuid>|30` — Slack caps option values at 75 chars, a uuid plus a token fits. */
export function encodeSelectValue(invoiceId: string, value: string): string {
  return `${invoiceId}|${value}`;
}

export function decodeSelectValue(
  raw: string | undefined,
): { invoiceId: string; value: string } | null {
  if (!raw) return null;
  const separator = raw.indexOf("|");
  if (separator <= 0) return null;
  const invoiceId = raw.slice(0, separator);
  const value = raw.slice(separator + 1);
  if (invoiceId.length === 0 || value.length === 0) return null;
  return { invoiceId, value };
}

export const DUE_DATE_PRESETS = [
  { value: "7", label: "in 7 days", days: 7 },
  { value: "14", label: "in 14 days", days: 14 },
  { value: "30", label: "in 30 days", days: 30 },
  { value: "60", label: "in 60 days", days: 60 },
] as const;

export const CURRENCY_OPTIONS = ["CZK", "EUR", "USD"] as const;

export const VAT_OPTIONS = [
  { value: "regular|none", label: "Regular · domestic" },
  { value: "regular|eu", label: "Regular · EU" },
  { value: "regular|non_eu", label: "Regular · outside EU" },
  { value: "reverse_charge|eu", label: "Reverse charge · EU" },
  { value: "reverse_charge|none", label: "Reverse charge · domestic" },
  { value: "oss|eu", label: "OSS · EU" },
] as const;

export const LANGUAGE_OPTIONS = [
  { value: "cs", label: "Czech" },
  { value: "en", label: "English" },
] as const;
