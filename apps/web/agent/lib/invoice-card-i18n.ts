import type { InvoiceLanguage } from "@invoicey/invoice-core/schema";

/**
 * Slack card copy, in the language the invoice is written in.
 *
 * There is no per-user locale stored anywhere (no column on `users`, and the
 * web app's locale lives in a `NEXT_LOCALE` cookie the agent cannot see), so
 * the invoice's own `meta.language` is the only language signal that is both
 * deterministic and already under the user's control. It defaults to `cs`,
 * which is the right default for a Czech-first product.
 */
export type CardLocale = InvoiceLanguage;

interface CardCopy {
  /** Lifecycle words used in the title and subtitle. */
  state: Record<"draft" | "issued" | "paid" | "cancelled" | "readonly", string>;
  docType: Record<string, string>;
  field: Record<string, string>;
  payment: Record<string, string>;
  vatMode: Record<string, string>;
  suppliesAbroad: Record<string, string>;
  language: Record<CardLocale, string>;
  action: Record<string, string>;
  /** Option labels in the single "change something" menu. */
  option: Record<string, string>;
  text: Record<string, string>;
}

const CS: CardCopy = {
  state: {
    draft: "Návrh",
    issued: "Vystaveno",
    paid: "Zaplaceno",
    cancelled: "Stornováno",
    readonly: "Faktura",
  },
  docType: {
    invoice: "Faktura",
    proforma: "Proforma",
    advance: "Zálohová faktura",
    credit_note: "Dobropis",
  },
  field: {
    total: "Celkem",
    subtotal: "Bez DPH",
    vat: "DPH",
    currency: "Měna",
    issueDate: "Datum vystavení",
    dueDate: "Splatnost",
    vatTreatment: "Režim DPH",
    payment: "Úhrada",
    language: "Jazyk dokladu",
    priceBasis: "Ceny položek",
  },
  payment: { transfer: "Převodem", cash: "Hotově", card: "Kartou" },
  vatMode: {
    regular: "Běžný",
    reverse_charge: "Přenesená daňová povinnost",
    oss: "OSS",
  },
  suppliesAbroad: { none: "tuzemsko", eu: "EU", non_eu: "mimo EU" },
  language: { cs: "čeština", en: "angličtina" },
  action: {
    issue: "Vystavit fakturu",
    previewPdf: "Náhled PDF",
    getPdf: "Stáhnout PDF",
    markPaid: "Označit zaplacenou",
    sendEmail: "Odeslat klientovi",
    discard: "Zahodit",
    openWeb: "Otevřít v Invoicey",
    change: "Změnit…",
  },
  option: {
    due: "Splatnost",
    days: "dní",
    currency: "Měna",
    language: "Jazyk",
    vat: "DPH",
  },
  text: {
    excludingVat: "bez DPH",
    includingVat: "včetně DPH",
    lines: "Položky",
    linesNote: "bez DPH",
    nonVatPayer: "Neplátce DPH",
    moreLines: "další položky",
    assumedTag: "doplněno",
    assumedHeading:
      ":warning: *Doplnili jsme za vás.* Změňte to níže, nebo mi napište.",
    suspectHeading: ":rotating_light: *Zkontrolujte před vystavením.*",
    issuedBy: "Vystaveno jako",
    by: "od",
    markedPaidBy: "Označeno jako zaplacené",
    sentTo: "Odesláno na",
    discardedBy: "Návrh zahodil",
    alreadyIssued: "_Již vystaveno._",
    discarded: "Zahozeno",
  },
};

const EN: CardCopy = {
  state: {
    draft: "Draft",
    issued: "Issued",
    paid: "Paid",
    cancelled: "Cancelled",
    readonly: "Invoice",
  },
  docType: {
    invoice: "Invoice",
    proforma: "Proforma",
    advance: "Advance",
    credit_note: "Credit note",
  },
  field: {
    total: "Total",
    subtotal: "Excl. VAT",
    vat: "VAT",
    currency: "Currency",
    issueDate: "Issue date",
    dueDate: "Due date",
    vatTreatment: "VAT treatment",
    payment: "Payment",
    language: "Document language",
    priceBasis: "Line prices",
  },
  payment: { transfer: "Bank transfer", cash: "Cash", card: "Card" },
  vatMode: {
    regular: "Regular",
    reverse_charge: "Reverse charge",
    oss: "OSS",
  },
  suppliesAbroad: { none: "domestic", eu: "EU", non_eu: "outside EU" },
  language: { cs: "Czech", en: "English" },
  action: {
    issue: "Issue invoice",
    previewPdf: "Preview PDF",
    getPdf: "Get PDF",
    markPaid: "Mark paid",
    sendEmail: "Send to client",
    discard: "Discard",
    openWeb: "Open in Invoicey",
    change: "Change…",
  },
  option: {
    due: "Due in",
    days: "days",
    currency: "Currency",
    language: "Language",
    vat: "VAT",
  },
  text: {
    excludingVat: "excluding VAT",
    includingVat: "including VAT",
    lines: "Lines",
    linesNote: "excl. VAT",
    nonVatPayer: "Non-VAT payer",
    moreLines: "more line(s)",
    assumedTag: "assumed",
    assumedHeading:
      ":warning: *Assumed — you did not say.* Change it below, or just tell me.",
    suspectHeading: ":rotating_light: *Check this before issuing.*",
    issuedBy: "Issued as",
    by: "by",
    markedPaidBy: "Marked paid",
    sentTo: "Sent to",
    discardedBy: "Draft discarded by",
    alreadyIssued: "_Already issued._",
    discarded: "Discarded",
  },
};

export function copyFor(locale: CardLocale): CardCopy {
  return locale === "en" ? EN : CS;
}

/**
 * Paths the normalizer can fill in, in a fixed order.
 *
 * The order is the wire format for {@link encodeAssumedMask}: adding a path is
 * safe only at the end, and removing one would shift every later bit. A card
 * posted before a change would then decode into the wrong fields.
 */
export const ASSUMABLE_PATHS = [
  "meta.issueDate",
  "meta.dueDate",
  "meta.duzp",
  "meta.language",
  "meta.currency",
  "meta.docType",
  "pricesIncludeVat",
  "vat",
  "vat.mode",
] as const;

export type AssumablePath = (typeof ASSUMABLE_PATHS)[number];

/**
 * Defaults that are right often enough not to warrant a warning. They are
 * still tagged on their own field; they just stay out of the notice block,
 * because a notice that flags seven things flags nothing.
 */
export const ROUTINE_PATHS: ReadonlySet<string> = new Set([
  "meta.issueDate",
  "meta.duzp",
  "meta.docType",
]);

/**
 * Which fields are still assumed, packed into a base-36 bitmask.
 *
 * Slack caps a select option's `value` at 75 characters, and a uuid already
 * eats 36 of them — a list of dotted paths does not fit, a 2-character mask
 * does. This is what lets an edit keep the *other* fields flagged instead of
 * silently clearing every warning on the card.
 */
export function encodeAssumedMask(paths: readonly string[]): string {
  let mask = 0;
  for (const path of paths) {
    const index = ASSUMABLE_PATHS.indexOf(path as AssumablePath);
    if (index >= 0) mask |= 1 << index;
  }
  return mask.toString(36);
}

export function decodeAssumedMask(mask: string | undefined): AssumablePath[] {
  if (!mask) return [];
  const parsed = Number.parseInt(mask, 36);
  if (!Number.isFinite(parsed) || parsed < 0) return [];
  return ASSUMABLE_PATHS.filter((_, index) => (parsed & (1 << index)) !== 0);
}

/** Reason copy per assumable path, so a rebuilt card can explain itself again. */
const REASONS: Record<AssumablePath, { cs: string; en: string }> = {
  "meta.issueDate": {
    cs: "dnešní datum",
    en: "today in Europe/Prague",
  },
  "meta.dueDate": {
    cs: "datum vystavení + 14 dní",
    en: "issue date + 14 days",
  },
  "meta.duzp": { cs: "stejné jako datum vystavení", en: "same as issue date" },
  "meta.language": { cs: "neuvedeno", en: "not specified" },
  "meta.currency": { cs: "neuvedeno", en: "not specified" },
  "meta.docType": { cs: "neuvedeno", en: "not specified" },
  pricesIncludeVat: { cs: "neuvedeno", en: "not specified" },
  vat: { cs: "odvozeno z předvolby", en: "expanded from preset" },
  "vat.mode": {
    cs: "nejste plátce DPH",
    en: "issuer is not a VAT payer",
  },
};

export function reasonFor(path: string, locale: CardLocale): string | null {
  const entry = REASONS[path as AssumablePath];
  return entry ? entry[locale === "en" ? "en" : "cs"] : null;
}

/** Field label per assumable path, for rebuilding a notice from a mask alone. */
const PATH_LABEL_KEYS: Record<AssumablePath, string> = {
  "meta.issueDate": "issueDate",
  "meta.dueDate": "dueDate",
  "meta.duzp": "issueDate",
  "meta.language": "language",
  "meta.currency": "currency",
  "meta.docType": "docType",
  pricesIncludeVat: "priceBasis",
  vat: "vatTreatment",
  "vat.mode": "vatTreatment",
};

export function labelFor(path: string, locale: CardLocale): string | null {
  const key = PATH_LABEL_KEYS[path as AssumablePath];
  if (!key) return null;
  const copy = copyFor(locale);
  return copy.field[key] ?? copy.docType[key] ?? null;
}
