import type { Invoice } from "../schema";

/** SPAYD 1.0 segment order for stable payloads (after SPD*1.0*). */
const SPAYD_KEY_ORDER = [
  "ACC",
  "AM",
  "CC",
  "RN",
  "X-VS",
  "X-SS",
  "X-KS",
  "PT",
  "MSG",
  "X-SELF",
] as const;

/** Escape asterisks inside SPAYD values using the standard's URL encoding. */
function escapeSpaydValue(raw: string): string {
  return raw.replaceAll("*", "%2A");
}

function stripDiacritics(input: string): string {
  return input.normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "");
}

/** Max length heuristics for MSG / RN compatibility with scanners. */
function truncateAscii(input: string, maxLen: number): string {
  const plain = stripDiacritics(input);
  if (plain.length <= maxLen) {
    return plain;
  }
  return plain.slice(0, maxLen);
}

type PaymentMessageVariables = {
  number: string;
  client: string;
  issuer: string;
};

function renderPaymentMessageTemplate(
  template: string,
  variables: PaymentMessageVariables,
): string {
  return template
    .replaceAll("{number}", variables.number)
    .replaceAll("{client}", variables.client)
    .replaceAll("{issuer}", variables.issuer)
    .replaceAll(/\s+/g, " ")
    .trim();
}

function defaultPaymentMessageTemplate(
  language: Invoice["meta"]["language"],
  audience: "beneficiary" | "payer",
): string {
  const label = language === "en" ? "Invoice" : "Faktura";
  const party = audience === "beneficiary" ? "{client}" : "{issuer}";
  return `${label} {number} | ${party}`;
}

/** SPAYD `AM`: payable amount in koruny (major units), not haléře. */
function formatSpaydAmCz(totalKorunu: number): string {
  const x = Math.round(totalKorunu * 100) / 100;
  if (x <= 0) {
    return "0";
  }
  const fixed = x.toFixed(2);
  if (fixed.endsWith(".00")) {
    return fixed.slice(0, -3);
  }
  return fixed;
}

/**
 * What a SPAYD payload actually needs, with no opinion about where it came
 * from. An invoice is one source; a payment request is another.
 */
export interface SpaydPaymentFacts {
  /** Beneficiary IBAN, already normalized. */
  iban: string;
  /** Optional BIC, appended to `ACC` after `+` when present. */
  bic?: string | null;
  /** Payable amount in major units (koruny). */
  amount: number;
  currency: string;
  /** Beneficiary name for `RN`; truncated for scanner compatibility. */
  beneficiaryName: string;
  /** `MSG` — shown to the beneficiary. Omitted when null. */
  beneficiaryMessage?: string | null;
  /** `X-SELF` — the payer's own note. Omitted when null. */
  payerNote?: string | null;
  variableSymbol?: string | null;
  constantSymbol?: string | null;
  specificSymbol?: string | null;
}

/** Build ČZ IBAN+BIC ACC field (+ separator when BIC present). */
function buildAcc(iban: string, bic: string | null | undefined): string {
  const trimmedBic = bic?.trim();
  if (trimmedBic && trimmedBic.length > 0) {
    return `${iban}+${trimmedBic}`;
  }
  return iban;
}

/**
 * Builds a Short Payment Descriptor 1.0 string from payment facts, or null
 * when the payment cannot be expressed as one (`spayd-qr.md`).
 *
 * Callers own their own domain guards: this refuses non-CZK, and nothing else.
 * It deliberately does not reject a zero amount, because the invoice path has
 * always emitted `AM:0` for a zero-total transfer.
 */
export function buildSpaydPayloadFromFacts(
  facts: SpaydPaymentFacts,
): string | null {
  if (facts.currency !== "CZK") {
    return null;
  }

  const parts = new Map<string, string>();
  parts.set("ACC", escapeSpaydValue(buildAcc(facts.iban, facts.bic)));
  parts.set("AM", escapeSpaydValue(formatSpaydAmCz(facts.amount)));
  parts.set("CC", escapeSpaydValue(facts.currency));
  parts.set("RN", escapeSpaydValue(truncateAscii(facts.beneficiaryName, 35)));

  if (
    facts.beneficiaryMessage !== undefined &&
    facts.beneficiaryMessage !== null
  ) {
    parts.set(
      "MSG",
      escapeSpaydValue(truncateAscii(facts.beneficiaryMessage, 60)),
    );
  }
  if (facts.payerNote !== undefined && facts.payerNote !== null) {
    parts.set("X-SELF", escapeSpaydValue(truncateAscii(facts.payerNote, 60)));
  }
  if (facts.variableSymbol) {
    parts.set("X-VS", escapeSpaydValue(facts.variableSymbol));
  }
  if (facts.constantSymbol) {
    parts.set("X-KS", escapeSpaydValue(facts.constantSymbol));
  }
  if (facts.specificSymbol) {
    parts.set("X-SS", escapeSpaydValue(facts.specificSymbol));
  }

  // Request an immediate payment when supported. Intentionally omit DT: a
  // future due date would instruct banking apps to schedule the transfer.
  parts.set("PT", "IP");

  const segments: string[] = [];
  for (const key of SPAYD_KEY_ORDER) {
    const v = parts.get(key);
    if (v !== undefined) {
      segments.push(`${key}:${v}`);
    }
  }

  return `SPD*1.0*${segments.join("*")}*`;
}

/**
 * Builds a Short Payment Descriptor 1.0 string for an invoice, or null when QR
 * must not appear (`spayd-qr.md`: non-transfer, missing bank, credit note
 * negative total).
 */
export function buildSpaydPayload(invoice: Invoice): string | null {
  return buildSpaydPayloadForAmount(invoice, invoice.totals.total);
}

/** Invoice adapter used when a partial payment leaves a smaller amount due. */
export function buildSpaydPayloadForAmount(
  invoice: Invoice,
  amount: number,
): string | null {
  if (invoice.payment.method !== "transfer" || !invoice.payment.bankAccount) {
    return null;
  }

  if (invoice.meta.docType === "credit_note" || invoice.totals.total < 0) {
    return null;
  }

  const messageVariables: PaymentMessageVariables = {
    number: invoice.meta.number,
    client: invoice.client.name,
    issuer: invoice.issuer.name,
  };

  return buildSpaydPayloadFromFacts({
    iban: invoice.payment.bankAccount.iban,
    bic: invoice.payment.bankAccount.bic,
    amount,
    currency: invoice.meta.currency,
    beneficiaryName: invoice.issuer.name,
    beneficiaryMessage: renderPaymentMessageTemplate(
      invoice.issuer.paymentQr?.beneficiaryMessageTemplate ??
        defaultPaymentMessageTemplate(invoice.meta.language, "beneficiary"),
      messageVariables,
    ),
    payerNote: renderPaymentMessageTemplate(
      invoice.issuer.paymentQr?.payerNoteTemplate ??
        defaultPaymentMessageTemplate(invoice.meta.language, "payer"),
      messageVariables,
    ),
    variableSymbol: invoice.payment.variableSymbol,
    constantSymbol: invoice.payment.constantSymbol,
    specificSymbol: invoice.payment.specificSymbol,
  });
}
