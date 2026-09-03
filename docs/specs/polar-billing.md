# Polar billing

**Plan:** 33 · **ADRs:** [0047](../decisions/0047-polar-billing-projects-into-invoicey.md),
[0035](../decisions/0035-plans-are-shared-entitlement-rows.md),
[0026](../decisions/0026-workspace-ai-tokens.md),
[0037](../decisions/0037-declarative-token-grants.md)  
**Research:** [`research/polar-billing.md`](../research/polar-billing.md)

## Goal

Collect money for Invoicey Pro and AI token packs through Polar. Invoicey’s
`plans` rows and AI-token ledgers stay the product authority. Polar answers
whether money was collected, refunded, or whether a subscription is still live.

## Tenant and authority

| Concept                      | Owner                                                                 |
| ---------------------------- | --------------------------------------------------------------------- |
| Polar customer `external_id` | Invoicey workspace id                                                 |
| Plan entitlements            | `plans` + `resolveEntitlements()`                                     |
| Who may change `plan_id`     | `workspaces.billing_authority`: `manual` or `polar`                   |
| Purchased tokens             | `billing_token_adjustments` + `ai_token_balances.purchased_remaining` |

Existing workspaces stay `manual` (grandfathered). Polar may change the plan
only after a verified paid subscription (or an explicit admin attach). Custom
plans (NFCtron) and Enterprise have no self-serve Polar product.

## Launch catalog

| Offer key       | Polar product      | Invoicey effect       |
| --------------- | ------------------ | --------------------- |
| `pro_monthly`   | recurring, monthly | assign Pro            |
| `pro_yearly`    | recurring, yearly  | assign Pro            |
| `tokens_small`  | one-time           | +2_000_000 purchased  |
| `tokens_medium` | one-time           | +10_000_000 purchased |
| `tokens_large`  | one-time           | +50_000_000 purchased |

Prices and CZK/EUR live only in Polar. Invoicey maps **product id → offer
key**. Unknown product ids are stored and never grant value.

`POLAR_ENVIRONMENT=sandbox|production` plus token, webhook secret, and the five
product ids. If the environment is set, the rest is required. Unset = billing
disabled, app still boots.

## Surfaces

Web only. Settings → **Billing** (`/settings/workspace/billing`).

- Owner/admin (`billing:manage`): start checkout, open Customer Portal.
- Everyone: see plan and Polar status.
- Checkout return (`…/billing/return?checkout_id=`) shows Polar checkout
  status. It never assigns a plan or credits tokens.
- Customer Portal: payment method, Polar invoices/receipts, cancel. No portal
  plan-switch or pause.
- Usage stays the token meter and links here.

MCP, CLI, Eve, and Slack do not touch billing.

## Fulfillment

`POST /api/webhooks/polar` verifies the raw body with Polar’s SDK helper,
persists `webhook-id` uniquely, then applies effects. Acknowledge only after
durable persistence. Unknown event types are recorded and acknowledged.

| Event                                         | Effect                                                                                                                                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `order.paid`                                  | Upsert customer + order. Recurring offer → Polar authority + Pro. One-time offer → purchased credit. `subscription_create` / `subscription_cycle` → reset monthly tokens to the Polar period. |
| `subscription.*`                              | Monotonic snapshot (`modified_at`). Keep access while not revoked. `revoked` → default Free, keep Polar authority.                                                                            |
| `order.refunded` / succeeded `refund.updated` | Cumulative refunded delta → purchased reversal. May go negative (debt).                                                                                                                       |
| `customer.*`                                  | Keep the local Polar customer row. Never rewrite OAuth identity.                                                                                                                              |

Refund tokens:

```
floor(pack_tokens × refunded_amount / original_amount)
```

applied as the delta from tokens already reversed on that Polar order.

Purchased-token debt (`purchased_remaining < 0`) blocks Invoicey-hosted AI
even if monthly or gifted remain.

## Local renewal

The daily AI cron skips a workspace that still has a live Polar subscription
(`active`, `past_due`, or `canceled` with no `ended_at`). After revocation the
workspace is on Free and the 30-day cron resumes.

## Checkout rules

Server-side only: resolve workspace + offer, never trust query product or
customer ids.

- Plan offers: refuse custom plans and Enterprise. Free and grandfathered Pro
  may subscribe. Monthly ↔ yearly is a new checkout, not a portal switch.
- Token packs: refuse unless resolved `ai.topUpEnabled`.
- `is_business_customer = true`, `external_customer_id = workspaceId`, UI
  locale, trusted `x-forwarded-for` / `x-real-ip`.

## Admin

`assignWorkspacePlan()` refuses when `billing_authority = polar` unless the
caller is Polar fulfillment or an explicit detach (no live subscription).
