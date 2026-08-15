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

/** Build ČZ IBAN+BIC ACC field (+ separator when BIC present). */
function buildAcc(account: Invoice["payment"]["bankAccount"]): string {
  if (!account) {
    return "";
  }
  const bic = account.bic?.trim();
  if (bic && bic.length > 0) {
    return `${account.iban}+${bic}`;
  }
  return account.iban;
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
 * Builds a Short Payment Descriptor 1.0 string, or null when QR must not appear
 * (`spayd-qr.md`: non-transfer, missing bank, credit note negative total).
 */
export function buildSpaydPayload(invoice: Invoice): string | null {
  if (invoice.payment.method !== "transfer" || !invoice.payment.bankAccount) {
    return null;
  }

  if (invoice.meta.docType === "credit_note" || invoice.totals.total < 0) {
    return null;
  }

  if (invoice.meta.currency !== "CZK") {
    return null;
  }

  const amountStr = formatSpaydAmCz(invoice.totals.total);
  const acc = buildAcc(invoice.payment.bankAccount);
  const parts = new Map<string, string>();
  const messageVariables: PaymentMessageVariables = {
    number: invoice.meta.number,
    client: invoice.client.name,
    issuer: invoice.issuer.name,
  };
  const beneficiaryMessage = renderPaymentMessageTemplate(
    invoice.issuer.paymentQr?.beneficiaryMessageTemplate ??
      defaultPaymentMessageTemplate(invoice.meta.language, "beneficiary"),
    messageVariables,
  );
  const payerNote = renderPaymentMessageTemplate(
    invoice.issuer.paymentQr?.payerNoteTemplate ??
      defaultPaymentMessageTemplate(invoice.meta.language, "payer"),
    messageVariables,
  );

  parts.set("ACC", escapeSpaydValue(acc));
  parts.set("AM", escapeSpaydValue(amountStr));
  parts.set("CC", escapeSpaydValue(invoice.meta.currency));
  parts.set("RN", escapeSpaydValue(truncateAscii(invoice.issuer.name, 35)));
  parts.set("MSG", escapeSpaydValue(truncateAscii(beneficiaryMessage, 60)));
  parts.set("X-SELF", escapeSpaydValue(truncateAscii(payerNote, 60)));

  if (invoice.payment.variableSymbol) {
    parts.set("X-VS", escapeSpaydValue(invoice.payment.variableSymbol));
  }
  if (invoice.payment.constantSymbol) {
    parts.set("X-KS", escapeSpaydValue(invoice.payment.constantSymbol));
  }
  if (invoice.payment.specificSymbol) {
    parts.set("X-SS", escapeSpaydValue(invoice.payment.specificSymbol));
  }

  // Request an immediate payment when supported. Intentionally omit DT: a
  // future due date would instruct banking apps to schedule the transfer.
  parts.set("PT", "IP");

  let out = "SPD*1.0*";
  const segments: string[] = [];

  for (const key of SPAYD_KEY_ORDER) {
    const v = parts.get(key);
    if (v !== undefined) {
      segments.push(`${key}:${v}`);
    }
  }

  out += segments.join("*");
  out += "*";
  return out;
}
