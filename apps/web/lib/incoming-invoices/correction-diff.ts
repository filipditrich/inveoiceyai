/**
 * Field-level diff between a rejected invoice and the correction the supplier
 * sent to replace it.
 *
 * The point is to answer "what did they actually change?" so the accountant
 * re-checks three fields instead of re-reading the invoice. Only fields that
 * differ are returned, in a fixed order — the order the review screen shows
 * them in, not the order they differ in, so the diff reads the same every time.
 */
const CORRECTION_FIELDS = [
  "number",
  "docType",
  "supplierName",
  "supplierIco",
  "issueDate",
  "taxDate",
  "dueDate",
  "currency",
  "subtotal",
  "vatTotal",
  "total",
  "variableSymbol",
  "constantSymbol",
  "specificSymbol",
  "paymentMethod",
  "beneficiaryIban",
  "beneficiaryAccountNumber",
  "beneficiaryBankCode",
  "messageForRecipient",
  "lineCount",
] as const;

export type CorrectionField = (typeof CORRECTION_FIELDS)[number];

/** Fields compared numerically, so "1000.00" and "1000" are the same value. */
const NUMERIC_FIELDS = new Set<CorrectionField>([
  "subtotal",
  "vatTotal",
  "total",
  "lineCount",
]);

export type CorrectionSnapshot = Partial<
  Record<CorrectionField, string | number | null | undefined>
>;

export type CorrectionDiffEntry = {
  field: CorrectionField;
  before: string | null;
  after: string | null;
  numeric: boolean;
};

function normalize(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function sameValue(
  field: CorrectionField,
  before: string | null,
  after: string | null,
): boolean {
  if (before === after) {
    return true;
  }
  if (before === null || after === null) {
    return false;
  }
  if (NUMERIC_FIELDS.has(field)) {
    const a = Number(before);
    const b = Number(after);
    // A non-numeric string in a numeric field falls back to text comparison
    // rather than silently comparing NaN to NaN.
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return a === b;
    }
  }
  return false;
}

export function diffCorrection(
  before: CorrectionSnapshot,
  after: CorrectionSnapshot,
): CorrectionDiffEntry[] {
  const entries: CorrectionDiffEntry[] = [];
  for (const field of CORRECTION_FIELDS) {
    const a = normalize(before[field]);
    const b = normalize(after[field]);
    if (sameValue(field, a, b)) {
      continue;
    }
    entries.push({
      field,
      before: a,
      after: b,
      numeric: NUMERIC_FIELDS.has(field),
    });
  }
  return entries;
}
