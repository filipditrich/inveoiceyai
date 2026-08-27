import {
  decodeAssumedMask,
  encodeAssumedMask,
  type AssumablePath,
} from "./invoice-card-i18n";

/**
 * Action-id vocabulary for Invoicey's own Slack card controls.
 *
 * Eve owns the `eve_input:` / `eve_input_freeform:` prefixes for its HITL
 * widgets and forwards everything else to `onInteraction`, so every id here
 * carries a distinct namespace.
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
  /**
   * One menu for every draft adjustment.
   *
   * Slack splits an actions block's width evenly across its elements, so four
   * separate selects render as unreadable single letters in a thread pane. A
   * lone select gets the whole row, and since each option label already names
   * its field ("Splatnost 30 dní", "Měna EUR") nothing is lost by merging them.
   */
  change: "invoicey:change",
} as const;

export type InvoiceyActionId =
  (typeof INVOICEY_ACTIONS)[keyof typeof INVOICEY_ACTIONS];

export function isInvoiceyAction(actionId: string): boolean {
  return actionId.startsWith(INVOICEY_ACTION_PREFIX);
}

/** Which draft field a `change` option targets. Single letters to save room. */
export type ChangeField = "d" | "c" | "l" | "v";

/**
 * Wire format for one `change` option: `<invoiceId>|<mask>|<field>:<value>`.
 *
 * Slack caps an option `value` at 75 characters and the uuid alone is 36, so
 * every part is kept terse — the VAT pair is encoded as `rc-eu` rather than
 * `reverse_charge|eu` to stay clear of the ceiling.
 */
export function encodeChangeValue(input: {
  invoiceId: string;
  assumedPaths: readonly string[];
  field: ChangeField;
  value: string;
}): string {
  const mask = encodeAssumedMask(input.assumedPaths);
  return `${input.invoiceId}|${mask}|${input.field}:${input.value}`;
}

export interface DecodedChange {
  invoiceId: string;
  assumedPaths: AssumablePath[];
  field: ChangeField;
  value: string;
}

export function decodeChangeValue(
  raw: string | undefined,
): DecodedChange | null {
  if (!raw) return null;
  const parts = raw.split("|");
  if (parts.length < 3) return null;
  const [invoiceId, mask, fieldAndValue] = parts;
  if (!invoiceId || !fieldAndValue) return null;
  const separator = fieldAndValue.indexOf(":");
  if (separator <= 0) return null;
  const field = fieldAndValue.slice(0, separator) as ChangeField;
  const value = fieldAndValue.slice(separator + 1);
  if (!value) return null;
  if (field !== "d" && field !== "c" && field !== "l" && field !== "v") {
    return null;
  }
  return {
    invoiceId,
    assumedPaths: decodeAssumedMask(mask),
    field,
    value,
  };
}

/** Button payload: `<invoiceId>|<mask>` — buttons only need the invoice. */
export function encodeButtonValue(
  invoiceId: string,
  assumedPaths: readonly string[],
): string {
  return `${invoiceId}|${encodeAssumedMask(assumedPaths)}`;
}

export function decodeButtonValue(
  raw: string | undefined,
): { invoiceId: string; assumedPaths: AssumablePath[] } | null {
  if (!raw) return null;
  const [invoiceId, mask] = raw.split("|");
  if (!invoiceId) return null;
  return { invoiceId, assumedPaths: decodeAssumedMask(mask) };
}

/** The draft path each change clears, so the rebuilt card stops flagging it. */
export const FIELD_TO_PATH: Record<ChangeField, AssumablePath> = {
  d: "meta.dueDate",
  c: "meta.currency",
  l: "meta.language",
  v: "vat",
};

export const DUE_DATE_PRESETS = [
  { value: "7", days: 7 },
  { value: "14", days: 14 },
  { value: "30", days: 30 },
  { value: "60", days: 60 },
] as const;

export const CURRENCY_OPTIONS = ["CZK", "EUR", "USD"] as const;

export const LANGUAGE_OPTIONS = ["cs", "en"] as const;

/** Compact VAT codes: `<mode>-<suppliesAbroad>`, kept short for the 75-char cap. */
export const VAT_OPTIONS = [
  { value: "r-n", mode: "regular", suppliesAbroad: "none" },
  { value: "r-eu", mode: "regular", suppliesAbroad: "eu" },
  { value: "r-ne", mode: "regular", suppliesAbroad: "non_eu" },
  { value: "rc-eu", mode: "reverse_charge", suppliesAbroad: "eu" },
  { value: "rc-n", mode: "reverse_charge", suppliesAbroad: "none" },
  { value: "o-eu", mode: "oss", suppliesAbroad: "eu" },
] as const;

export function vatOptionFor(
  code: string,
): { mode: string; suppliesAbroad: string } | null {
  const found = VAT_OPTIONS.find((option) => option.value === code);
  return found
    ? { mode: found.mode, suppliesAbroad: found.suppliesAbroad }
    : null;
}
