# 0052: Durable notification events fan out to channel deliveries

## Status

Accepted

## Context

Payment emails are currently sent after ledger writes. If the process exits in
that gap, the financial state is correct but the message is lost. Pocket needs
push on settlement, and later Invoicey events such as invoice-payment matches
need the same reliability without coupling accounting code to APNs, email, or a
particular client.

## Decision

- A business transition writes a deduplicated `notification_events` row in the
  **same database transaction** as the transition.
- A notification engine resolves recipients and reviewed copy, then creates one
  immutable intent per recipient/channel in `notification_deliveries`.
- Delivery is at least once. Unique event and destination keys make retries and
  overlapping workers harmless.
- APNs is the first push adapter. Permanent token failures disable that device;
  transient failures remain pending for retry.
- `in_app` deliveries form the canonical notification inbox. Push is an
  attention channel pointing back to that record, not the system of record.
- Missing provider credentials queue work and never roll back settlement.
- Existing payment email flows remain separate during this phase. They may
  migrate behind this engine once their preference and suppression behavior is
  represented as a channel policy.

## Consequences

The write path gains one local database insert but no network dependency.
Delivery latency is normally immediate after bank import and bounded by the
minute retry sweep after a crash. Event payloads are deliberately factual;
localized copy belongs to presentation policies, so future channels can render
the same event independently.

## References

- [Notification engine spec](../specs/notifications.md)
- [Invoicey Pocket spec](../specs/invoicey-pocket.md)
- [ADR 0051](./0051-payment-requests-self-settle.md)
