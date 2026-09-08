# 0051: Payment requests self-settle without the auto-confirm opt-in

## Status

Proposed

## Context

Bank matching against invoices is deliberately conservative.
`autoConfirmExactMatches` defaults to `false`, and `isExactAutoMatchProposal`
demands a perfect score, `high` confidence, no blockers, and all four of
`receiving_account`, `currency`, `exact_variable_symbol`,
`exact_outstanding_amount`. Everything heuristic, partial, overpaid, or
ambiguous stays manual.

That caution is correct for invoices because the match _infers_ intent. The
payer chose what to type into the variable symbol field, chose how much to send,
and may have been paying something else entirely. A high score is evidence, not
proof.

A **payment request** inverts this. Invoicey generated the variable symbol from
a reserved namespace, generated the amount, and named the receiving account.
A credit matching all three is not an inference about a payer's intent — it is
the thing Invoicey itself asked for, coming back.

Applying the invoice rule here would mean a user creates a request for 500 Kč,
watches exactly 500 Kč arrive on exactly the generated symbol, and is then asked
to confirm that it is what they just asked for. That is a worse product for no
additional safety.

## Decision

- A credit auto-settles a payment request when **all** of: exact generated
  variable symbol, exact requested amount, expected receiving account, and the
  request is open.
- This does **not** consult `autoConfirmExactMatches`. That flag governs
  inference about invoice payments and is left untouched.
- Implement it as a distinct, separately tested policy. Do **not** widen
  `isExactAutoMatchProposal` — the invoice rule must stay narrow, and the two
  policies must be readable side by side.
- Settlement is decoupled from watching. A qualifying credit that arrives long
  after the watch session ended settles the same way; being observed live is a
  UX property, not evidence.
- Every other case stays manual: short amount (show partial, never round up to
  paid), overpayment (settle and flag), a request already settled (surface as a
  duplicate needing review, never settle twice), correct amount with no or wrong
  symbol (propose, never auto-settle), reversal (reverse explicitly).
- Auto-settlements are audited in `payment_audit_events` like every other
  unattended confirmation.

## Consequences

- A future reader will see auto-confirmation gated for invoices but not for
  payment requests and may read it as an oversight or a hole. That asymmetry is
  the entire point of this record.
- The safety of the rule depends on the variable symbol genuinely being
  Invoicey-generated and unique on the receiving account. If symbol allocation
  ever degrades to something guessable, reusable, or collision-prone, this
  decision must be revisited — the two are load-bearing for each other.
- Cancelled and stale requests still match late credits ([ADR 0050](./0050-polymorphic-payment-allocations.md)
  keeps one reversal path), so cancellation must not be implemented as deletion.

## References

- [Instant QR payment acceptance research](../research/instant-qr-payment-acceptance.md)
- [ADR 0029 — provider-neutral payment ledger with Fio first](./0029-payment-ledger-fio-first.md)
- [ADR 0050 — payment allocations settle invoices or payment requests](./0050-polymorphic-payment-allocations.md)
