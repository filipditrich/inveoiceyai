-- Repair invoices issued through the web builder before its row projection
-- persisted the immutable payment identifiers used by bank matching.
UPDATE invoices
SET
  payment_account_iban = upper(
    regexp_replace(
      payload_json #>> '{payment,bankAccount,iban}',
      '[[:space:]]',
      '',
      'g'
    )
  ),
  updated_at = now()
WHERE payment_account_iban IS NULL
  AND coalesce(payload_json #>> '{payment,bankAccount,iban}', '') <> '';

UPDATE invoices
SET
  payment_variable_symbol = nullif(
    regexp_replace(
      payload_json #>> '{payment,variableSymbol}',
      '[^0-9]',
      '',
      'g'
    ),
    ''
  ),
  updated_at = now()
WHERE payment_variable_symbol IS NULL
  AND coalesce(payload_json #>> '{payment,variableSymbol}', '') <> '';
