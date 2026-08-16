import { isValidCzIban } from "../bank/czech-iban";
import { isValidIban, normalizeIban } from "./iban";
import { isValidCzIco, normalizeIcoDigits } from "./ico";

export const INCOMING_EXCEPTION_CODES = [
  "duplicate_invoice",
  "entity_unresolved",
  "supplier_unknown",
  "new_beneficiary_account",
  "vat_mismatch",
  "line_total_mismatch",
  "missing_required_field",
  "due_before_issue",
  "invalid_iban",
  "invalid_ico",
  "low_confidence",
  "currency_unsupported",
  "unverified_sender",
] as const;

export type IncomingExceptionCode = (typeof INCOMING_EXCEPTION_CODES)[number];

export const PAYMENT_CURRENCIES = ["CZK", "EUR"] as const;

export type IncomingValidationInput = {
  supplierId?: string | null;
  supplierIco?: string | null;
  supplierName?: string | null;
  number?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  currency?: string | null;
  total?: string | null;
  subtotal?: string | null;
  vatTotal?: string | null;
  vatBreakdown?: Array<{ rate: string; base: string; vat: string }>;
  lines?: Array<{
    lineSubtotal?: string | null;
    lineVat?: string | null;
    lineTotal?: string | null;
  }>;
  paymentMethod?: string | null;
  beneficiaryIban?: string | null;
  beneficiaryAccountNumber?: string | null;
  beneficiaryBankCode?: string | null;
  beneficiaryConfirmed?: boolean;
  issuerResolved?: boolean;
  duplicateOfId?: string | null;
  extractionSource?: string | null;
  extractionConfidence?: Record<string, "high" | "medium" | "low">;
  authFailed?: boolean;
  missingFields?: string[];
};

export type IncomingException = {
  code: IncomingExceptionCode;
  field?: string;
};

const ACCEPT_BLOCKING_FIELDS = [
  "supplierId",
  "number",
  "issueDate",
  "dueDate",
  "currency",
  "total",
] as const;

function asMinor(value: string | null | undefined): bigint | null {
  if (value == null || value === "") {
    return null;
  }
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/u.exec(value.trim());
  if (!match) {
    return null;
  }
  const sign = match[1] === "-" ? -BigInt(1) : BigInt(1);
  const whole = BigInt(match[2] ?? "0");
  const frac = (match[3] ?? "").padEnd(2, "0").slice(0, 2);
  return sign * (whole * BigInt(100) + BigInt(frac || "0"));
}

function abs(n: bigint): bigint {
  return n < BigInt(0) ? -n : n;
}

/**
 * Produce exception codes for an extracted incoming invoice.
 * Does not mutate the record; the caller persists `exception_codes`.
 */
export function validateIncomingInvoice(
  input: IncomingValidationInput,
): IncomingException[] {
  const exceptions: IncomingException[] = [];

  if (input.duplicateOfId) {
    exceptions.push({ code: "duplicate_invoice" });
  }
  if (input.issuerResolved === false) {
    exceptions.push({ code: "entity_unresolved" });
  }
  if (
    !input.supplierId &&
    !normalizeIcoDigits(input.supplierIco) &&
    !input.supplierName
  ) {
    exceptions.push({ code: "supplier_unknown" });
  }

  const missing = [...(input.missingFields ?? [])];
  if (!input.supplierId) missing.push("supplierId");
  if (!input.number?.trim()) missing.push("number");
  if (!input.issueDate) missing.push("issueDate");
  if (!input.dueDate) missing.push("dueDate");
  if (!input.currency) missing.push("currency");
  if (input.total == null || input.total === "") missing.push("total");
  if (
    (input.paymentMethod ?? "transfer") === "transfer" &&
    !normalizeIban(input.beneficiaryIban) &&
    !(input.beneficiaryAccountNumber && input.beneficiaryBankCode)
  ) {
    missing.push("beneficiary");
  }
  if (missing.length > 0) {
    exceptions.push({ code: "missing_required_field", field: missing[0] });
  }

  if (input.issueDate && input.dueDate && input.dueDate < input.issueDate) {
    exceptions.push({ code: "due_before_issue" });
  }

  const ico = normalizeIcoDigits(input.supplierIco);
  if (ico && !isValidCzIco(ico)) {
    exceptions.push({ code: "invalid_ico" });
  }

  const iban = normalizeIban(input.beneficiaryIban);
  if (iban) {
    const ok = iban.startsWith("CZ") ? isValidCzIban(iban) : isValidIban(iban);
    if (!ok) {
      exceptions.push({ code: "invalid_iban" });
    }
  }

  if (input.currency && !PAYMENT_CURRENCIES.includes(input.currency as "CZK")) {
    exceptions.push({ code: "currency_unsupported" });
  }

  const total = asMinor(input.total);
  const subtotal = asMinor(input.subtotal);
  const vatTotal = asMinor(input.vatTotal);
  if (total != null && subtotal != null && vatTotal != null) {
    if (abs(subtotal + vatTotal - total) > BigInt(1)) {
      exceptions.push({ code: "vat_mismatch" });
    }
  }
  if (input.vatBreakdown) {
    for (const row of input.vatBreakdown) {
      const base = asMinor(row.base);
      const vat = asMinor(row.vat);
      const rate = Number(row.rate);
      if (base == null || vat == null || !Number.isFinite(rate)) {
        continue;
      }
      const expected = (base * BigInt(Math.round(rate))) / BigInt(100);
      if (abs(expected - vat) > BigInt(1)) {
        exceptions.push({ code: "vat_mismatch" });
        break;
      }
    }
  }

  if (input.lines && input.lines.length > 0 && total != null) {
    let lineSum = BigInt(0);
    let any = false;
    for (const line of input.lines) {
      const lineTotal = asMinor(line.lineTotal);
      if (lineTotal == null) {
        continue;
      }
      lineSum += lineTotal;
      any = true;
    }
    if (any && abs(lineSum - total) > BigInt(1)) {
      exceptions.push({ code: "line_total_mismatch" });
    }
  }

  if (input.beneficiaryConfirmed === false) {
    exceptions.push({ code: "new_beneficiary_account" });
  }

  if (input.extractionSource === "ai") {
    const confidence = input.extractionConfidence ?? {};
    for (const field of ACCEPT_BLOCKING_FIELDS) {
      if (confidence[field] === "low") {
        exceptions.push({ code: "low_confidence", field });
        break;
      }
    }
  }

  if (input.authFailed) {
    exceptions.push({ code: "unverified_sender" });
  }

  return exceptions;
}

export function normalizeInvoiceNumber(
  number: string | null | undefined,
): string | null {
  if (!number) {
    return null;
  }
  const normalized = number.toUpperCase().replaceAll(/[^A-Z0-9]/gu, "");
  return normalized.length > 0 ? normalized : null;
}

/** 31 Dec of (tax year + 10), § 35 ZDPH. */
export function computeRetainUntil(
  taxDate?: string | null,
  issueDate?: string | null,
): string {
  const source = taxDate || issueDate;
  const year =
    source && /^\d{4}/u.test(source)
      ? Number(source.slice(0, 4))
      : new Date().getUTCFullYear();
  return `${year + 10}-12-31`;
}

export function acceptBlockingReasons(
  exceptions: IncomingException[],
): IncomingException[] {
  const blocking = new Set<IncomingExceptionCode>([
    "duplicate_invoice",
    "missing_required_field",
    "entity_unresolved",
  ]);
  return exceptions.filter((item) => blocking.has(item.code));
}
