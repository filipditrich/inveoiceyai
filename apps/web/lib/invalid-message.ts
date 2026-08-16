const KNOWN_INVALID_CODES = [
  "required_fields",
  "missing_parties",
  "validation",
  "missing_scheme",
  "already_issued",
  "not_draft",
  "cannot_issue",
  "has_invoices",
  "has_templates",
  "has_client_invoices",
  "missing_id",
  "missing_name",
  "duplicate_name",
  "unsupported_doc_type",
  "not_found",
  "invalid_day",
  "invalid_cadence",
  "open_draft",
  "invalid_payload",
  "not_reviewable",
  "missing_required_field",
  "duplicate_invoice",
  "retention_window",
  "reason_required",
  "four_eyes",
  "forbidden",
  "not_ready",
  "empty_run",
  "payment_token_missing",
  "payment_token_expired",
  "fio_throttled_locally",
  "sum_mismatch",
  "run_create_failed",
] as const;

type KnownInvalidCode = (typeof KNOWN_INVALID_CODES)[number];

function isKnownInvalidCode(code: string): code is KnownInvalidCode {
  return (KNOWN_INVALID_CODES as readonly string[]).includes(code);
}

type TranslateInvalid = (
  key: KnownInvalidCode | "generic",
  values?: { code: string },
) => string;

export function invalidMessage(t: unknown, code: string): string {
  /** next-intl translator overloads vs a single signature */
  const translate = t as TranslateInvalid;
  if (isKnownInvalidCode(code)) {
    return translate(code);
  }
  return translate("generic", { code });
}
