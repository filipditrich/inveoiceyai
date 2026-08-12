import type { Invoice } from "../schema";

/** SPAYD 1.0 segment order for stable payloads (after SPD*1.0*). */
const SPAYD_KEY_ORDER = [
  "ACC",
  "AM",
  "CC",
  "RN",
  "MSG",
  "VS",
  "KS",
  "SS",
  "DT",
] as const;

/** Escape asterisks inside SPAYD values per ČBA conventions. */
function escapeSpaydValue(raw: string): string {
  return raw.replaceAll("*", "**");
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

  parts.set("ACC", escapeSpaydValue(acc));
  parts.set("AM", escapeSpaydValue(amountStr));
  parts.set("CC", escapeSpaydValue(invoice.meta.currency));
  parts.set("RN", escapeSpaydValue(truncateAscii(invoice.issuer.name, 36)));
  parts.set(
    "MSG",
    escapeSpaydValue(truncateAscii(`${invoice.meta.number}`.trim(), 40)),
  );

  if (invoice.payment.variableSymbol) {
    parts.set("VS", escapeSpaydValue(invoice.payment.variableSymbol));
  }
  if (invoice.payment.constantSymbol) {
    parts.set("KS", escapeSpaydValue(invoice.payment.constantSymbol));
  }
  if (invoice.payment.specificSymbol) {
    parts.set("SS", escapeSpaydValue(invoice.payment.specificSymbol));
  }

  const due = invoice.meta.dueDate.replaceAll("-", "");
  parts.set("DT", escapeSpaydValue(due));

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
