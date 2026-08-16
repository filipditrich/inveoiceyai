const INCOMING_EXCEPTION_CODES = [
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

export type IncomingExceptionMessageKey =
  | `exceptions.${(typeof INCOMING_EXCEPTION_CODES)[number]}`
  | "exceptions.unknown";

export function incomingExceptionMessageKey(
  code: string,
): IncomingExceptionMessageKey {
  return INCOMING_EXCEPTION_CODES.includes(
    code as (typeof INCOMING_EXCEPTION_CODES)[number],
  )
    ? (`exceptions.${code}` as IncomingExceptionMessageKey)
    : "exceptions.unknown";
}
