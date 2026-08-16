# 0033: Payment initiation is a bank-signed batch, never an Invoicey payment

## Status

Accepted

## Context

The payable side of the product is only useful if it ends in a payment. Typing
twenty payment orders into internet banking by hand is the single most tedious
step in the whole chain, and it is the step where transposed account numbers
actually cost money.

But payment initiation is also the most dangerous capability a product like this
can hold. ADR 0029 deliberately scoped Plan 22 to a **read-only** monitoring
token and recorded payment initiation as "a separate future capability". This
ADR is that separate decision.

The determining fact comes from the Fio API documentation:

> "Po úspěšném uploadu dat se příkazy sdruží v bankovním systému do dávky, která
> musí být dodatečně autorizována (sms, fio podpis) oprávněnou osobou na účtu.
> Bez dodatečné autorizace nebudou příkazy zpracovány."

An uploaded batch lands in the account owner's _orders to sign_ queue. It is
inert until a signatory authorizes it with SMS or Fio podpis, inside Fio's own
channel, with Fio's own second factor. A compromised Invoicey cannot move a
single koruna; it can at worst place a batch in a queue where a human sees it
before signing.

Fio's token model reinforces this: a token belongs to exactly one account, must
carry an expiry of at most 180 days, and is created only under strong
authorization — with every signatory signing on multi-signature accounts.

## Decision

- **Ship Fio batch submission, and never claim more than it is.** Invoicey builds
  a Fio import XML from a confirmed payment run and posts it to
  `https://fioapi.fio.cz/v1/rest/import/`. The run then reads _submitted to bank
  — awaiting your authorization in Fio internet banking_, with the returned
  batch id shown. No state in Invoicey may say "paid" as a result of a
  submission.
- **A payment run is only ever created by an explicit human confirmation.** No
  rule, schedule, cron, or agent may create or submit one. Approval (gate 2)
  decides that a cost is legitimate; it never decides that money moves this
  week.
- **The submit token is a separate credential from the read token.** It is stored
  in its own encrypted columns on `bank_connections` with its own fingerprint,
  key version, expiry, and 30-second throttle clock. Revoking payment rights
  must not break statement sync, and a workspace that never wants initiation
  simply never supplies one. `access_mode` records which capabilities a
  connection actually has.
- **The submit token is never used for reading**, even though Fio's submit-rights
  token can read. Least privilege per call path, and it keeps the two throttle
  clocks independent.
- **Beneficiary details are frozen onto the run line** at the moment the run is
  confirmed, not read from the supplier master at submit time. What a person
  approved on screen is exactly what is sent, and a later edit to a supplier
  cannot silently redirect a pending batch.
- **A new beneficiary account is a blocking condition, not a warning.** An
  account never before seen for that supplier IČO cannot enter a payment run
  until someone explicitly confirms it against the supplier. Changing the bank
  line on a real invoice is the standard invoice-fraud pattern, and this is the
  one place the product can actually stop it.
- **v1 rails are domestic and SEPA/T2 only.** Foreign (`ForeignTransaction`)
  orders need charge-bearer choices, beneficiary address completeness, and a
  correspondent-bank story that cannot be validated without real traffic. A
  payable that resolves to a foreign rail is excluded from runs with a clear
  reason.
- **Submission is idempotent at the run level.** A run has one successful
  submission; retries are only permitted from a failed state, each attempt
  audited. Fio accepts or rejects the whole file, so partial-submission state
  does not exist and must not be modelled.
- **Reconciliation closes the loop through the existing ledger.** The debit that
  appears on the next statement sync is matched back to the payable through the
  payables matcher, with the run line as the strongest signal. Only that
  allocation marks a payable paid.
- **No agent surface.** Payment runs and submission are web-only, with no MCP or
  Eve tools, mirroring the Plan 15 web-only boundary.

## Consequences

- The user keeps a second Fio token with submit rights, expiring at most every
  180 days. Expiry monitoring and a re-entry prompt are product requirements,
  not niceties.
- The 2 MB file limit and the strict `domestic → T2 → foreign` element ordering
  constrain the XML builder; large runs must be split into several batches, each
  separately authorized in Fio, and the UI has to make that comprehensible.
- Invoicey's `errorCode` / `status` handling must treat `warning` (accepted with
  a complaint) differently from `error` and `fatal` (nothing accepted), and
  surface Fio's own message text rather than a generic failure.
- Because Invoicey cannot confirm execution, a run can sit indefinitely in
  "awaiting authorization". Reconciliation, not submission, is the completion
  signal, and the UI must not imply otherwise.
- Adding a second bank's initiation later means a `PaymentInitiationAdapter`
  interface; the run and run-line model is deliberately provider-neutral, only
  the file builder and transport are Fio-specific.
- Holding a submit-rights credential raises the security bar for the whole
  application: key rotation, audit coverage, and least-privilege review now have
  a concrete blast radius attached to them.

## Plans touched

- Plan 24e — payables, payment runs, Fio submission, debit reconciliation

## References

- [Payables, payment runs, and Fio submission specification](../specs/payables-payment-runs-fio.md)
- [0029 — provider-neutral payment ledger with Fio first](./0029-payment-ledger-fio-first.md)
- [0031 — incoming invoices as a first-class payable domain](./0031-incoming-invoice-payable-ledger.md)
- [Fio API Bankovnictví (PDF, v. 16. 10. 2025)](https://www.fio.cz/docs/cz/API_Bankovnictvi.pdf)
- [Fio import XSD](https://www.fio.cz/schema/importIB.xsd)
