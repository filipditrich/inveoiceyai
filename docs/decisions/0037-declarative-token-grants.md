# 0037: Token grants are declarative rules on one idempotent ledger

## Status

Accepted (2026-08-27)

## Context

ADR 0026 established workspace AI tokens with three buckets (gifted, monthly,
purchased). Grants are currently hardcoded: every workspace gets
`SIGNUP_GIFTED_TOKENS = 500_000` at create, regardless of anything. Platform
admin can already gift a workspace tokens (`adminGrantTokens`, which credits
`gifted` and writes a security audit event), but that path is a bare balance
increment with no record of _which_ award it represented — so it cannot be made
idempotent, and it cannot answer "how did this workspace get its tokens".

Plan 26 adds two more grant shapes: per-plan signup amounts (250k on Free, 500k
on Pro) and a **milestone grant** — a further 500k when the workspace issues its
first invoice, marketed and notified as a reward. Sponsored plans get neither.

Three distinct-looking features (plan signup grant, milestone grant, admin
discretionary grant) share one requirement: credit a bucket **exactly once**,
with an audit trail.

## Decision

1. Grants are **declared as data** in `entitlements.ai.grants`:
   `{ key, trigger: "signup" | "first_invoice_issued", tokens, bucket: "gifted", notify }`.
2. One **`workspace_token_grants`** ledger records every application, unique on
   `(workspace_id, rule_key)`. The unique index _is_ the idempotency mechanism —
   apply is an insert-or-skip inside the crediting transaction.
3. **`adminGrantTokens` moves onto the same ledger**, with
   `rule_key = "manual:<uuid>"`, `granted_by` set to the admin, and its existing
   free-text note. It keeps its security-audit event; the ledger row is what
   makes the grant attributable to an award rather than an anonymous balance
   bump. No separate table, no separate code path.
4. `first_invoice_issued` fires inside the issue transaction, after numbering
   succeeds — never from a cron sweep or a client callback.
5. `notify: true` sends the in-app + email notification once, keyed off the
   ledger insert, so a retry cannot double-notify.
6. `ai_token_balances.monthly_limit` is seeded and re-seeded from
   `entitlements.ai.monthlyIncludedTokens` on plan assignment and on period
   renewal, replacing the module-constant default.

## Consequences

- A new grant trigger is a schema addition plus one call site; new _amounts_ are
  pure `/admin` data.
- "Gift this workspace 2M tokens because they hit a bug" keeps working and gains
  a row that says what it was, next to the plan and milestone awards, so support
  can read one table to explain a balance.
- Retrying a failed issue cannot double-credit, because the ledger insert and
  the balance credit share a transaction.
- Changing a grant rule's `key` re-grants to every existing workspace. Keys are
  therefore treated as immutable identifiers; the admin UI warns on edit.
- Raising a plan's signup grant does **not** retroactively top up existing
  workspaces — a manual grant remains the tool for that.

## Alternatives considered

**Hardcode the milestone in `issueInvoiceById` with a boolean column on
`workspaces`.** Rejected — a third one-off mechanism next to two existing ones,
and no audit trail for support grants.

**Cron sweep that finds workspaces with ≥1 issued invoice and no milestone
grant.** Rejected — the reward lands minutes late, which destroys the marketing
moment, and the sweep needs the same idempotency ledger anyway.

**Leave `adminGrantTokens` as a direct balance increment.** Rejected — it would
be the one award with no row explaining it, so the ledger could never fully
answer "how did this workspace get its tokens", which is exactly the question
support asks.

## Plans touched

- Plan 26 — Plans, entitlements, and workspace permissions

## References

- [ADR 0026](./0026-workspace-ai-tokens.md)
- [ADR 0035](./0035-plans-are-shared-entitlement-rows.md)
- [docs/specs/ai-usage.md](../specs/ai-usage.md)
- [docs/specs/plans-entitlements.md](../specs/plans-entitlements.md)
