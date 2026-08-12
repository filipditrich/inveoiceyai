# 0027: Recurring schedules materialize drafts only

## Status

Accepted (2026-08-12)

## Context

Plan 10 needs scheduled invoicing for the personal monthly loop (UC1). Auto-issuing from cron would consume numbering, freeze snapshots, and possibly email a client without a human check. Duplicate-as-draft already exists but copies dates and snapshots as-is and is web-only.

## Decision

1. A due recurrence **inserts a draft** (`meta.number = "DRAFT"`, `issuedAt` null). The user issues and sends in the web app.
2. At materialize time, **refresh issuer and client from live rows** and recompute `issueDate` / `duzp` / `dueDate` and totals. Snapshots still freeze at Issue (ADR 0008).
3. Numbering is not consumed until Issue.
4. Cron never calls `issueInvoiceById` or `sendInvoiceEmailById`.
5. Catch-up creates **one** draft, then jumps `next_run_on` to the next future occurrence.

## Consequences

- Recurring is HITL by default; full automation is a later opt-in.
- Bank/VAT/address changes on the issuer or client apply to the next draft.
- If a previous recurring draft is still unissued, the cron skips rather than piling drafts.

## Alternatives considered

**Cron issues (and optionally emails) the invoice.** Rejected for v1 — numbering and client mail without review is too sharp.

**Copy duplicateInvoice as-is (keep source dates and snapshots).** Rejected — a June invoice duplicated in August would be backdated.

**Reuse MCP `presets`.** Rejected — presets are overlay JSON without cadence, FKs, or next-run.

## Plans touched

- Plan 10 — Recurring invoice drafts

## References

- [ADR 0008](./0008-snapshot-issuer-client-at-issue-time.md)
- [docs/specs/recurring.md](../specs/recurring.md)
