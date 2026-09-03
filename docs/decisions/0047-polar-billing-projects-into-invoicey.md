# 0047: Polar owns commerce; Invoicey owns entitlements and credits

## Status

Accepted (2026-09-03)

## Context

Invoicey already has the product-side primitives for paid tiers: shared `plans`
rows, workspace plan assignment, resolved entitlements, and separate gifted,
monthly, and purchased AI-token balances. What it does not have is a commerce
path. Pro is still free during beta, plan changes are made by platform admin,
and the token top-up controls are disabled placeholders.

Adding a merchant-of-record provider creates two authorities that must not be
conflated:

- Polar knows whether money was collected, refunded, disputed, or whether a
  subscription is active.
- Invoicey knows what a plan permits and how many AI tokens a workspace may
  consume.

Making Polar products or benefits the runtime entitlement model would undo ADR
0035: a provider outage or catalog edit could change application behaviour, and
custom sponsored plans would be forced into a public checkout model they do not
belong to. Treating the checkout success redirect as proof of payment would be
even weaker: the browser is controlled by the buyer and can arrive before the
provider's financial state is final.

Top-ups also introduce reversals. The existing `workspace_token_grants` ledger
is deliberately positive-only and models awards, not purchases. Reusing it for
refunds would either destroy its invariant or leave paid credits impossible to
revoke safely.

## Decision

1. **Polar is the merchant of record and financial authority.** Invoicey uses
   Polar Checkout for self-serve paid plans and one-time token packs, and Polar's
   customer portal for payment methods, receipts/invoices, cancellation, and
   other provider-owned billing operations.
2. **Invoicey's `plans` rows remain the product authority.** A verified Polar
   subscription state is projected onto `workspaces.plan_id`; it never copies
   provider benefits into `plans.entitlements`, and application code still
   resolves behaviour only through `resolveEntitlements()`.
3. **The workspace is the billable tenant.** Each workspace maps to at most one
   Polar customer by using the workspace UUID as Polar's external customer id.
   A user's separate workspaces never share a subscription or purchased-token
   pool.
4. **Only verified server-to-server state changes value.** Checkout return pages
   show pending/success status but never assign a plan or credit tokens. Signed,
   idempotently processed webhooks drive both effects; reconciliation repairs
   missed or out-of-order delivery.
5. **Provider products are mapped to local effects through an explicit local
   allowlist.** A recurring product maps to one internal `plan_id`; a one-time
   product maps to an immutable token amount. Unknown or inactive products are
   quarantined and never grant value. Provider metadata is diagnostic, not an
   authorization input.
6. **Commercial state is projected, not inferred ad hoc.** Invoicey persists
   billing customer, subscription, order, and webhook projections with provider
   ids, amounts, currency, timestamps, and processing state. The projection is
   supportable without replaying logs or querying Polar on every request.
7. **Purchased tokens get a separate signed adjustment ledger.** Purchase,
   partial-refund, full-refund, and dispute adjustments update
   `purchased_remaining` atomically and idempotently. A reversal may create a
   purchased-token debt if credits were already consumed; debt blocks further
   Invoicey-hosted AI until it is cleared. Gifted-token grant semantics remain
   unchanged.
8. **Manual and sponsored plans are protected.** Polar may manage only a
   workspace explicitly placed under Polar plan authority. Existing assignments
   are grandfathered. Custom plans such as NFCtron do not expose subscription
   checkout, and platform-admin takeover must explicitly detach or resolve any
   live subscription first.
9. **Paid-plan cancellation is non-destructive.** The paid plan remains active
   through its paid period and moves to the default Free plan only when the
   provider state says access has ended. Existing data remains readable; the
   established write-path quotas govern an over-limit workspace.
10. **Billing is web-only in the first release.** MCP, CLI, Eve, and Slack do
    not create checkouts, expose portal sessions, or mutate billing state.

## Launch policy (2026-09-03)

Pinned before implementation:

1. Keep paid-plan access through Polar dunning (`past_due`) until
   `subscription.revoked`. Show a billing banner; do not use Polar benefits as
   entitlements.
2. Polar-managed workspaces reset monthly AI tokens on the Polar subscription
   window (`order.paid` with `subscription_create` / `subscription_cycle`). The
   30-day cron skips a workspace that still has a live Polar subscription.
3. Checkout and Customer Portal require `billing:manage` (owner and admin
   presets). Members may see billing status.
4. Free may buy token packs when `ai.topUpEnabled` is on. A pack never assigns
   Pro. NFCtron stays top-up off.
5. Self-serve offers: `pro_monthly`, `pro_yearly` (both → Pro), and packs of
   2M / 10M / 50M tokens. Prices live only in Polar.
6. CZK is the Polar org default; EUR may exist as extra Polar prices. Invoicey
   fulfills from product id. Checkout forwards the buyer IP.
7. No Invoicey billing-profile table. Checkout is B2B; Polar stores billing
   identity. Portal edits must not write OAuth users, issuers, or clients.
8. Existing Pro workspaces stay `manual` until they check out or an admin
   places them under Polar. No mass charge or downgrade.
9. Customer Portal in v1: payment method, Polar invoices/receipts, cancel. No
   portal plan-switch or pause. Monthly ↔ yearly is a new Invoicey checkout.
10. Token refunds: `floor(pack_tokens × refunded_amount / original_amount)` on
    the cumulative refunded delta per Polar order. Over-spend becomes purchased
    debt and blocks Invoicey-hosted AI.
11. Settings → **Billing** (`/settings/workspace/billing`). Usage stays the
    token meter. The checkout return page never fulfills.
12. If `POLAR_ENVIRONMENT` is set, the access token, webhook secret, and every
    launch product id are required. No sandbox fallback in production.

## Consequences

- Polar can change payment and tax mechanics without becoming an application
  feature-flag service.
- Plan entitlements and commercial price are intentionally independent: an
  admin can tune the Pro entitlement row without recreating a Polar product.
- Webhook handling is financial infrastructure. It needs an inbox, monotonic
  projection rules, idempotency constraints, operator visibility, and a repair
  path rather than a single route with side effects.
- Invoicey must add a billing-assignment source/authority instead of continuing
  to overload nullable `plan_assigned_by`.
- Token refunds are visible adjustments, never destructive edits to the grant
  ledger or usage history.
- Existing beta and sponsored workspaces are not automatically charged or
  downgraded when billing ships. They enter self-serve billing only through an
  explicit checkout or operator migration.
- Enterprise may remain sales-led while using the same mapping model later;
  the first launch does not need a special code path for it.

## Alternatives considered

**Use Polar benefits as Invoicey entitlements.** Rejected: it creates two
entitlement schemas, couples every request to provider concepts, and weakens
custom-plan support.

**Grant on the checkout success redirect.** Rejected: the redirect is not proof
of settlement, is replayable by the browser, and may race the webhook.

**Put Polar product ids directly on `plans`.** Rejected: sandbox and production
catalogs differ, top-up products do not represent plans, and one plan may later
have more than one billing interval.

**Reuse `workspace_token_grants` for purchases.** Rejected: it cannot express
negative refund/dispute adjustments without breaking the accepted positive,
exactly-once award model in ADR 0037.

**Make the user's account the billing tenant.** Rejected: plans, entitlements,
usage, and data tenancy are workspace-scoped, and one user may operate unrelated
workspaces.

## Plans touched

- Plan 33 — Polar billing for plans and AI-token top-ups

## References

- [ADR 0019](./0019-workspaces-are-better-auth-organizations.md)
- [ADR 0026](./0026-workspace-ai-tokens.md)
- [ADR 0035](./0035-plans-are-shared-entitlement-rows.md)
- [ADR 0037](./0037-declarative-token-grants.md)
- [Polar billing specification](../specs/polar-billing.md)
